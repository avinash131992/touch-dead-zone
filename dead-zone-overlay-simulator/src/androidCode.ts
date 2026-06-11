export interface CodeFile {
  name: string;
  path: string;
  language: string;
  code: string;
  description: string;
}

export const ANDROID_PROJECT_CODE: CodeFile[] = [
  {
    name: "OverlayService.kt",
    path: "app/src/main/java/com/deadzone/overlay/OverlayService.kt",
    language: "kotlin",
    description: "Crucial foreground service that spawns overlay windows on top of the screen system stack. Tracks touch events to block dead zones AND features a 10-second press-and-hold emergency safeguard button.",
    code: `package com.deadzone.overlay

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.os.Build
import android.os.IBinder
import android.util.TypedValue
import android.view.*
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import kotlin.math.max

/**
 * Foreground Service that creates, positions, and resizes the Dead Zone overlay
 * using WindowManager. It runs in the background and processes touchscreen overlays.
 * Includes a 10-second long-press requirement to stop/disable the service.
 */
class OverlayService : Service() {

    private lateinit var windowManager: WindowManager
    
    // Core Dead Zone items
    private var deadZoneView: FrameLayout? = null
    private lateinit var deadZoneParams: WindowManager.LayoutParams
    
    // Emergency Disable Button items
    private var emergencyButtonView: FrameLayout? = null
    private lateinit var emergencyParams: WindowManager.LayoutParams

    // Service state
    private var isLocked: Boolean = false
    private var deadZoneWidth = 600
    private var deadZoneHeight = 400
    private var deadZoneX = 100
    private var deadZoneY = 200

    companion object {
        const val NOTIFICATION_ID = 1001
        const val CHANNEL_ID = "DeadZoneServiceChannel"
        const val ACTION_TOGGLE_LOCK = "com.deadzone.overlay.ACTION_TOGGLE_LOCK"
        const val ACTION_STOP_SERVICE = "com.deadzone.overlay.ACTION_STOP_SERVICE"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_TOGGLE_LOCK -> {
                toggleLockState()
            }
            ACTION_STOP_SERVICE -> {
                stopSelf()
                return START_NOT_STICKY
            }
        }

        // Start as foreground service to prevent system kill
        val notification = buildNotification()
        startForeground(NOTIFICATION_ID, notification)

        // Initialize elements if not already created
        if (deadZoneView == null) {
            setupDeadZoneOverlay()
            setupEmergencyButton()
        }

        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Dead Zone Overlay Control",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Controls and status for the active touch blocking dead zone overlay."
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val lockActionText = if (isLocked) "Unlock Config" else "Lock & Block Touches"
        
        val toggleIntent = Intent(this, OverlayService::class.java).apply {
            action = ACTION_TOGGLE_LOCK
        }
        val pToggle = PendingIntent.getService(
            this, 1, toggleIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val stopIntent = Intent(this, OverlayService::class.java).apply {
            action = ACTION_STOP_SERVICE
        }
        val pStop = PendingIntent.getService(
            this, 2, stopIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val mainActivityIntent = Intent(this, MainActivity::class.java)
        val pMainActivity = PendingIntent.getActivity(
            this, 0, mainActivityIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Dead Zone Overlay Status: \${if (isLocked) \\"LOCKED & BLOCKING\\" else \\"UNLOCKED (EDITING)\\"}")
            .setContentText(if (isLocked) "Touches inside the rectangle are currently absorbed." else "Drag and resize the overlay box to position it.")
            .setSmallIcon(android.R.drawable.ic_menu_close_clear_cancel)
            .setContentIntent(pMainActivity)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_lock, lockActionText, pToggle)
            .addAction(android.R.drawable.ic_menu_delete, "Disable Overlay", pStop)
            .build()
    }

    private fun toggleLockState() {
        isLocked = !isLocked
        
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, buildNotification())
        
        updateOverlayState()
    }

    private fun setupDeadZoneOverlay() {
        deadZoneView = FrameLayout(this)
        
        val layoutFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
        }

        deadZoneParams = WindowManager.LayoutParams(
            deadZoneWidth,
            deadZoneHeight,
            layoutFlag,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or 
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or 
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = deadZoneX
            y = deadZoneY
        }

        buildDeadZoneUI()
        windowManager.addView(deadZoneView, deadZoneParams)
    }

    private fun buildDeadZoneUI() {
        val view = deadZoneView ?: return
        view.removeAllViews()

        val panel = FrameLayout(this).apply {
            val bgColor = if (isLocked) Color.argb(45, 239, 68, 68) else Color.argb(100, 59, 130, 246)
            setBackgroundColor(bgColor)
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        view.addView(panel)

        val infoText = TextView(this).apply {
            text = if (isLocked) "⚡ TOUCH BLOCKED ZONE" else "✥ DRAG HERE TO MOVE\\n✥ DRAG BOTTOM-RIGHT TO RESIZE"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
            gravity = Gravity.CENTER
            textAlignment = TextView.TEXT_ALIGNMENT_CENTER
            setTypeface(Typeface.create("sans-serif-medium", Typeface.BOLD))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            ).apply {
                gravity = Gravity.CENTER
                setMargins(20, 20, 20, 20)
            }
        }
        panel.addView(infoText)

        if (isLocked) {
            panel.setOnTouchListener { _, event ->
                true
            }
            return
        }

        // Draggable Move Handler
        panel.setOnTouchListener(object : View.OnTouchListener {
            private var initX = 0
            private var initY = 0
            private var initTouchX = 0f
            private var initTouchY = 0f

            override fun onTouch(v: View?, event: MotionEvent?): Boolean {
                if (event == null) return false
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initX = deadZoneParams.x
                        initY = deadZoneParams.y
                        initTouchX = event.rawX
                        initTouchY = event.rawY
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val dx = (event.rawX - initTouchX).toInt()
                        val dy = (event.rawY - initTouchY).toInt()
                        deadZoneParams.x = initX + dx
                        deadZoneParams.y = initY + dy
                        
                        deadZoneX = deadZoneParams.x
                        deadZoneY = deadZoneParams.y
                        
                        windowManager.updateViewLayout(deadZoneView, deadZoneParams)
                        return true
                    }
                }
                return false
            }
        })

        // Resize bottom right handle
        val resizeHandle = FrameLayout(this).apply {
            setBackgroundColor(Color.argb(220, 59, 130, 246))
            layoutParams = FrameLayout.LayoutParams(
                dpToPx(36),
                dpToPx(36)
            ).apply {
                gravity = Gravity.BOTTOM or Gravity.END
            }
        }

        val resizeIcon = ImageView(this).apply {
            setImageResource(android.R.drawable.ic_menu_crop)
            imageTintList = ColorStateList.valueOf(Color.WHITE)
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            ).apply {
                setMargins(4, 4, 4, 4)
            }
        }
        resizeHandle.addView(resizeIcon)

        resizeHandle.setOnTouchListener(object : View.OnTouchListener {
            private var initWidth = 0
            private var initHeight = 0
            private var initTouchX = 0f
            private var initTouchY = 0f

            override fun onTouch(v: View?, event: MotionEvent?): Boolean {
                if (event == null) return false
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initWidth = deadZoneParams.width
                        initHeight = deadZoneParams.height
                        initTouchX = event.rawX
                        initTouchY = event.rawY
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val dx = (event.rawX - initTouchX).toInt()
                        val dy = (event.rawY - initTouchY).toInt()
                        
                        deadZoneWidth = max(dpToPx(100), initWidth + dx)
                        deadZoneHeight = max(dpToPx(80), initHeight + dy)
                        
                        deadZoneParams.width = deadZoneWidth
                        deadZoneParams.height = deadZoneHeight
                        
                        windowManager.updateViewLayout(deadZoneView, deadZoneParams)
                        return true
                    }
                }
                return false
            }
        })
        view.addView(resizeHandle)

        // Lock button shortcut in editing view
        val quickLockBtn = FrameLayout(this).apply {
            setBackgroundColor(Color.argb(230, 31, 41, 55))
            layoutParams = FrameLayout.LayoutParams(
                dpToPx(32),
                dpToPx(32)
            ).apply {
                gravity = Gravity.BOTTOM or Gravity.START
                setMargins(dpToPx(8), 0, 0, dpToPx(8))
            }
        }
        val lockImg = ImageView(this).apply {
            setImageResource(android.R.drawable.ic_menu_lock)
            imageTintList = ColorStateList.valueOf(Color.rgb(34, 197, 94))
            scaleType = ImageView.ScaleType.FIT_CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            ).apply {
                setMargins(dpToPx(6), dpToPx(6), dpToPx(6), dpToPx(6))
            }
        }
        quickLockBtn.addView(lockImg)
        quickLockBtn.setOnClickListener {
            toggleLockState()
        }
        view.addView(quickLockBtn)
    }

    private fun updateOverlayState() {
        buildDeadZoneUI()
        windowManager.updateViewLayout(deadZoneView, deadZoneParams)
    }

    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private var holdDurationMs = 0L
    private var holdRunnable: Runnable? = null

    /**
     * Creates and mounts the Floating Emergency Disable Button.
     * Requires holding for 10 seconds before stopping to avoid accidental touch disables.
     */
    private fun setupEmergencyButton() {
        emergencyButtonView = FrameLayout(this)

        val layoutFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
        }

        emergencyParams = WindowManager.LayoutParams(
            dpToPx(56),
            dpToPx(56),
            layoutFlag,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or 
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.END
            x = dpToPx(16)
            y = dpToPx(80)
        }

        val backgroundShape = FrameLayout(this).apply {
            setBackgroundColor(Color.argb(235, 239, 68, 68))
            minimumWidth = dpToPx(48)
            minimumHeight = dpToPx(48)
            elevation = 12f
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }

        val cancelIcon = ImageView(this).apply {
            setImageResource(android.R.drawable.ic_menu_close_clear_cancel)
            imageTintList = ColorStateList.valueOf(Color.WHITE)
            scaleType = ImageView.ScaleType.FIT_CENTER
            layoutParams = FrameLayout.LayoutParams(
                dpToPx(24),
                dpToPx(24)
            ).apply {
                gravity = Gravity.CENTER
            }
        }
        backgroundShape.addView(cancelIcon)

        val tooltip = TextView(this).apply {
            text = "HOLD TO STOP"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 8f)
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.BOTTOM
                setMargins(0, 0, 0, 2)
            }
        }
        backgroundShape.addView(tooltip)

        emergencyButtonView?.addView(backgroundShape)

        emergencyButtonView?.setOnTouchListener(object : View.OnTouchListener {
            private var initX = 0
            private var initY = 0
            private var initTouchX = 0f
            private var initTouchY = 0f
            private var isDragging = false
            private var hasStopped = false

            override fun onTouch(v: View?, event: MotionEvent?): Boolean {
                if (event == null || hasStopped) return false
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initX = emergencyParams.x
                        initY = emergencyParams.y
                        initTouchX = event.rawX
                        initTouchY = event.rawY
                        isDragging = false
                        holdDurationMs = 0L

                        tooltip.text = "STOPPING"
                        tooltip.setTextColor(Color.YELLOW)

                        holdRunnable = object : Runnable {
                            override fun run() {
                                holdDurationMs += 250
                                val remaining = 10 - (holdDurationMs / 1000)
                                if (remaining > 0) {
                                    tooltip.text = "STOPPING"
                                    
                                    val progressColor = if ((holdDurationMs / 250) % 2 == 0L) {
                                        Color.rgb(220, 38, 38)
                                    } else {
                                        Color.rgb(239, 68, 68)
                                    }
                                    backgroundShape.setBackgroundColor(progressColor)
                                    mainHandler.postDelayed(this, 250)
                                } else {
                                    hasStopped = true
                                    stopSelf()
                                }
                            }
                        }
                        mainHandler.postDelayed(holdRunnable!!, 250)
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val dx = (event.rawX - initTouchX).toInt()
                        val dy = (event.rawY - initTouchY).toInt()
                        
                        if (kotlin.math.abs(dx) > 15 || kotlin.math.abs(dy) > 15) {
                            isDragging = true
                        }
                        
                        emergencyParams.x = initX - dx
                        emergencyParams.y = initY + dy
                        windowManager.updateViewLayout(emergencyButtonView, emergencyParams)
                        return true
                    }
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                        holdRunnable?.let { mainHandler.removeCallbacks(it) }
                        holdRunnable = null
                        
                        if (!hasStopped) {
                            tooltip.text = "HOLD TO STOP"
                            tooltip.setTextColor(Color.WHITE)
                            backgroundShape.setBackgroundColor(Color.argb(235, 239, 68, 68))
                            
                            if (!isDragging && holdDurationMs < 1000) {
                                Toast.makeText(this@OverlayService, "Keep button held for 10 seconds to stop!", Toast.LENGTH_SHORT).show()
                            }
                        }
                        isDragging = false
                        return true
                    }
                }
                return false
            }
        })

        windowManager.addView(emergencyButtonView, emergencyParams)
    }

    private fun dpToPx(dp: Int): Int {
        val density = resources.displayMetrics.density
        return (dp * density).toInt()
    }

    override fun onDestroy() {
        super.onDestroy()
        deadZoneView?.let {
            try { windowManager.removeView(it) } catch (e: Exception) {}
        }
        emergencyButtonView?.let {
            try { windowManager.removeView(it) } catch (e: Exception) {}
        }
    }
}`
  },
  {
    name: "MainActivity.kt",
    path: "app/src/main/java/com/deadzone/overlay/MainActivity.kt",
    language: "kotlin",
    description: "Main settings activity crafted in Android Jetpack Compose. Configures the 'STOP (HOLD)' button which requires pressing and holding for a full 10 seconds with precise feedback before stopping the background overlay service overlay.",
    code: `package com.deadzone.overlay

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class MainActivity : ComponentActivity() {

    private val overlayPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val hasPermission = Settings.canDrawOverlays(this)
            showToast(if (hasPermission) "Overlay permission approved!" else "Permission was not granted.")
        }
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            showToast("Notification permission approved.")
        } else {
            showToast("Note: Notifications are disabled. Custom overlay status cannot be shown.")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        requestNotificationPermission()

        setContent {
            var hasOverlayPermission by remember { mutableStateOf(checkOverlayPermission()) }
            var isServiceRunning by remember { mutableStateOf(false) }

            LaunchedEffect(Unit) {
                hasOverlayPermission = checkOverlayPermission()
            }

            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF3B82F6),
                    background = Color(0xFF111827),
                    surface = Color(0xFF1F2937),
                    onPrimary = Color.White,
                    error = Color(0xFFEF4444)
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MainAppLayout(
                        hasOverlayPermission = hasOverlayPermission,
                        onRequestPermission = { launchOverlayPermissionSettings() },
                        onStartService = {
                            if (checkOverlayPermission()) {
                                startOverlayService()
                                isServiceRunning = true
                                showToast("Dead Zone Service STARTED")
                            } else {
                                showToast("Please authorize 'Draw Over Other Apps' first.")
                            }
                        },
                        onStopService = {
                            stopOverlayService()
                            isServiceRunning = false
                            showToast("Dead Zone Service STOPPED")
                        },
                        showToast = { showToast(it) }
                    )
                }
            }
        }
    }

    private fun checkOverlayPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(this)
        } else {
            true
        }
    }

    private fun launchOverlayPermissionSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
            overlayPermissionLauncher.launch(intent)
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun startOverlayService() {
        val intent = Intent(this, OverlayService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun stopOverlayService() {
        val intent = Intent(this, OverlayService::class.java)
        stopService(intent)
    }

    private fun showToast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }
}

@Composable
fun MainAppLayout(
    hasOverlayPermission: Boolean,
    onRequestPermission: () -> Unit,
    onStartService: () -> Unit,
    onStopService: () -> Unit,
    showToast: (String) -> Unit
) {
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(24.dp))
        
        Icon(
            imageVector = Icons.Default.Warning,
            contentDescription = "App Emblem",
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(56.dp)
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        Text(
            text = "TOUCH DEAD ZONE",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.ExtraBold,
            color = Color.White,
            letterSpacing = 1.sp
        )
        
        Text(
            text = "Android Touch-Blocking Screen Overlay Controller",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.Gray,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 8.dp)
        )

        Spacer(modifier = Modifier.height(24.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface
            )
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(
                            text = "Permission Stat",
                            fontSize = 12.sp,
                            color = Color.Gray
                        )
                        Text(
                            text = if (hasOverlayPermission) "APPROVED" else "REQUIRED",
                            fontWeight = FontWeight.Bold,
                            color = if (hasOverlayPermission) Color(0xFF22C55E) else Color(0xFFEF4444)
                        )
                    }

                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .background(
                                color = if (hasOverlayPermission) Color(0xFF22C55E) else Color(0xFFEF4444),
                                shape = CircleShape
                            )
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "Android requires explicit 'Draw over other apps' authorization to deploy target overlays outside of active window boundaries.",
                    fontSize = 13.sp,
                    color = Color.LightGray
                )

                if (!hasOverlayPermission) {
                    Spacer(modifier = Modifier.height(14.dp))
                    Button(
                        onClick = onRequestPermission,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary
                        ),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(imageVector = Icons.Default.Settings, contentDescription = "Settings Icon")
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = "Grant Drawing Permission")
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface
            )
        ) {
            Column(
                modifier = Modifier.padding(16.dp)
            ) {
                Text(
                    text = "Overlay Engine State",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = Color.White
                )
                
                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = "Toggle the foreground service below to display the dead zone canvas.",
                    fontSize = 13.sp,
                    color = Color.LightGray
                )

                Spacer(modifier = Modifier.height(20.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Button(
                        onClick = { onStartService() },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF22C55E)
                        ),
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Icon(Icons.Default.PlayArrow, contentDescription = "Start Icon")
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("START", fontWeight = FontWeight.Bold)
                    }

                    // Stop Button (Requires 10-second hold)
                    var holdProgress by remember { mutableStateOf(0f) }
                    var isPressing by remember { mutableStateOf(false) }

                    LaunchedEffect(isPressing) {
                        if (isPressing) {
                            val startTime = System.currentTimeMillis()
                            while (isPressing) {
                                val elapsed = System.currentTimeMillis() - startTime
                                holdProgress = (elapsed.toFloat() / 10000f).coerceAtMost(1f)
                                if (holdProgress >= 1f) {
                                    onStopService()
                                    isPressing = false
                                    holdProgress = 0f
                                    break
                                }
                                kotlinx.coroutines.delay(30)
                            }
                        } else {
                            holdProgress = 0f
                        }
                    }

                    Button(
                        onClick = {}, // Handled by pointerInput
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isPressing) Color(0xFF991B1B) else MaterialTheme.colorScheme.error
                        ),
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp)
                            .pointerInput(Unit) {
                                detectTapGestures(
                                    onPress = {
                                        try {
                                            isPressing = true
                                            val pressStartTime = System.currentTimeMillis()
                                            awaitRelease()
                                            val elapsed = System.currentTimeMillis() - pressStartTime
                                            if (elapsed < 1000) {
                                                showToast("Keep holding for 10 seconds to stop!")
                                            }
                                        } finally {
                                            isPressing = false
                                        }
                                    }
                                )
                            },
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        if (isPressing) {
                            Text(
                                "STOPPING",
                                fontWeight = FontWeight.Black,
                                fontSize = 12.sp,
                                color = Color.Yellow
                            )
                        } else {
                            Icon(Icons.Default.Close, contentDescription = "Stop Icon")
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("STOP", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}`
  },
  {
    name: "AndroidManifest.xml",
    path: "app/src/main/AndroidManifest.xml",
    language: "xml",
    description: "Configures global app and service permissions. Includes critical accessibility guidelines and parameters to run high-priority overlay services under modern Google Play policies.",
    code: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.deadzone.overlay">

    <!-- Permissions required for overlay execution -->
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:allowBackup="true"
        android:icon="@android:drawable/ic_menu_close_clear_cancel"
        android:label="Dead Zone Touch Blocker"
        android:supportsRtl="true"
        android:theme="@style/Theme.DeadZoneOverlay">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|screenLayout|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".OverlayService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property 
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Touch Screen Dead Zone Overlay to secure designated screen regions from accidental palm or finger interactions." />
        </service>

    </application>
</manifest>`
  },
  {
    name: "app/build.gradle.kts",
    path: "app/build.gradle.kts",
    language: "kotlin",
    description: "Details app compilation targets (SDK 34), compile libraries, Kotlin optimizations, Jetpack Compose UI options, and dependency imports.",
    code: `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.deadzone.overlay"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.deadzone.overlay"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        compose = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation(platform("androidx.compose:compose-bom:2023.10.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
} `
  }
];
