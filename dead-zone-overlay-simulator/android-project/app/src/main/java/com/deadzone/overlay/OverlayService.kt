package com.deadzone.overlay

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
import androidx.core.app.NotificationCompat
import kotlin.math.max

/**
 * Foreground Service that creates, positions, and resizes the Dead Zone overlay
 * using WindowManager. It runs in the background and processes touchscreen overlays.
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
            .setContentTitle("Dead Zone Overlay Status: ${if (isLocked) "LOCKED & BLOCKING" else "UNLOCKED (EDITING)"}")
            .setContentText(if (isLocked) "Touches inside the rectangle are currently absorbed." else "Drag and resize the overlay box to position it.")
            .setSmallIcon(android.R.drawable.ic_menu_close_clear_cancel)
            .setContentIntent(pMainActivity)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_lock, lockActionText, pToggle)
            .addAction(android.R.drawable.ic_menu_delete, "Disable Overlay", pStop)
            .build()
    }

    /**
     * Toggles whether the overlay is interactive matching size (and acts as simple block)
     * or offers resizing handles.
     */
    private fun toggleLockState() {
        isLocked = !isLocked
        
        // Update notification
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, buildNotification())
        
        // Re-configure overlay window flags and interface
        updateOverlayState()
    }

    private fun setupDeadZoneOverlay() {
        // Base view for overlay
        deadZoneView = FrameLayout(this)
        
        // Setup WindowManager Layout Parameters
        val layoutFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
        }

        // We use FLAG_NOT_FOCUSABLE so standard system actions and soft keys work normally.
        // We use FLAG_LAYOUT_NO_LIMITS to place it anywhere on screen.
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

        // 1. Core Dead Zone Panel
        val panel = FrameLayout(this).apply {
            // Unlocked state is soft semi-transparent red/pink; locked state can be very subtle
            val bgColor = if (isLocked) Color.argb(45, 239, 68, 68) else Color.argb(100, 59, 130, 246)
            setBackgroundColor(bgColor)
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        view.addView(panel)

        // 2. Center Info text regarding locking state
        val infoText = TextView(this).apply {
            text = if (isLocked) "⚡ TOUCH BLOCKED ZONE" else "✥ DRAG HERE TO MOVE\n✥ DRAG BOTTOM-RIGHT TO RESIZE"
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

        // If locked, we don't need any resize handles and gestures can be deactivated.
        // If locked, we still absorb touches inside the view container by returning true.
        if (isLocked) {
            panel.setOnTouchListener { _, event ->
                // Consume all touch events inside this bounds so they NEVER propagate down
                true
            }
            return
        }

        // Unlocked Mode: Add movement and resizing controllers
        
        // A. Draggable Center Area
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
                        
                        // Keep within reasonable bounds
                        deadZoneX = deadZoneParams.x
                        deadZoneY = deadZoneParams.y
                        
                        windowManager.updateViewLayout(deadZoneView, deadZoneParams)
                        return true
                    }
                }
                return false
            }
        })

        // B. Resize Handle at bottom right corner
        val resizeHandle = FrameLayout(this).apply {
            setBackgroundColor(Color.argb(220, 59, 130, 246)) // Strong active blue
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

        // C. Clean Quick Lock Overlay Button inside helper
        val quickLockBtn = FrameLayout(this).apply {
            setBackgroundColor(Color.argb(230, 31, 41, 55)) // Dark circular indicator
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
            imageTintList = ColorStateList.valueOf(Color.rgb(34, 197, 94)) // Green lock status
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
        // Redraw GUI content based on locking
        buildDeadZoneUI()
        
        // When locked, we want to fully prevent focus, but maintain touch interception
        if (isLocked) {
            // Keep original params, but we change visual indicators
            deadZoneParams.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        } else {
            deadZoneParams.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        }

        windowManager.updateViewLayout(deadZoneView, deadZoneParams)
    }

    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private var holdDurationMs = 0L
    private var holdRunnable: Runnable? = null

    /**
     * Creates and mounts the Floating Emergency Disable Button in a separate window path.
     * This requires the user to HOLD down for 10 seconds before terminating the service
     * in order to completely prevent accidental shutdowns.
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
            y = dpToPx(80) // Place it slightly below status bar height on the right
        }

        // Circular background drawable styled programmatically
        val backgroundShape = FrameLayout(this).apply {
            setBackgroundColor(Color.argb(235, 239, 68, 68)) // Glowing red emergency shade
            minimumWidth = dpToPx(48)
            minimumHeight = dpToPx(48)
            elevation = 12f
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }

        // Inner Power / Stop icon
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

        // Tooltip text helper
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

        // Support holding and dragging the emergency button
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
                                    
                                    // Make it flash and change color
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
                        
                        emergencyParams.x = initX - dx // gravity is TOP-END so moving left increases layout's x
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
        // Safely wipe out views from the desktop stack
        deadZoneView?.let {
            try {
                windowManager.removeView(it)
            } catch (e: Exception) {
                // Ignore if already detached
            }
        }
        emergencyButtonView?.let {
            try {
                windowManager.removeView(it)
            } catch (e: Exception) {
                // Ignore if already detached
            }
        }
    }
}
