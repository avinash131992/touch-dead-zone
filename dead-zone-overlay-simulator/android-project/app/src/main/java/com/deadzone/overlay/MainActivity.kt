package com.deadzone.overlay

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

/**
 * Main Activity dashboard developed in Jetpack Compose.
 * Manages system permissions and operates the foreground overlay service.
 */
class MainActivity : ComponentActivity() {

    // Launcher for overlay settings drawing request
    private val overlayPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val hasPermission = Settings.canDrawOverlays(this)
            showToast(if (hasPermission) "Overlay permission approved!" else "Permission was not granted.")
        }
    }

    // Launcher for notification permission (Required for Android 13+)
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
            var isServiceRunning by remember { mutableStateOf(false) } // Visual helper local state

            // Check if service is indeed up (could be verified using activity lifecycle or intents)
            LaunchedEffect(Unit) {
                hasOverlayPermission = checkOverlayPermission()
            }

            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF3B82F6), // Tailored Blue Accent
                    background = Color(0xFF111827), // Charcoal Slate
                    surface = Color(0xFF1F2937), // Balanced Grey Cards
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
        
        // 1. App Header Title
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
            letterSpacing = 1.sp,
            fontFamily = FontFamily.SansSerif
        )
        
        Text(
            text = "Android Touch-Blocking Screen Overlay Controller",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.Gray,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 8.dp)
        )

        Spacer(modifier = Modifier.height(24.dp))

        // 2. Permission Indicator Card
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

        // 3. Main On/Off Service Controls Card
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
                    text = "Toggle the foreground service below to display the dead zone canvas and floating safety trigger widget.",
                    fontSize = 13.sp,
                    color = Color.LightGray
                )

                Spacer(modifier = Modifier.height(20.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Start Button
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

        Spacer(modifier = Modifier.height(20.dp))

        // 4. Instructions & Design Schema Guide
        Text(
            text = "HOW TO OPERATE",
            fontWeight = FontWeight.Bold,
            color = Color.White,
            modifier = Modifier.fillMaxWidth(),
            fontSize = 14.sp,
            textAlign = TextAlign.Start
        )

        Spacer(modifier = Modifier.height(10.dp))

        StepCard(
            stepNum = 1,
            title = "Establish Placement",
            description = "Start the service. A transparent blue overlay will appear. Drag its center to relocate, or drag the bottom-right corner handles to resize the blocked quadrant."
        )

        Spacer(modifier = Modifier.height(8.dp))

        StepCard(
            stepNum = 2,
            title = "Lock In Place",
            description = "Click the green Lock Icon at the bottom-left inside the box (or check the system notification drop-down block). Once locked, the zone transitions into a touch block, feeding clicks into empty state, while passing events outside normally."
        )

        Spacer(modifier = Modifier.height(8.dp))

        StepCard(
            stepNum = 3,
            title = "Floating Emergency Override",
            description = "A floating circular red emergency toggle matches every launch. Tap this shortcut button instantly from any application screen to terminate the drawing overlay."
        )

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
fun StepCard(stepNum: Int, title: String, description: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF1F2937).copy(alpha = 0.5f)
        )
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.Top
        ) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .background(Color(0xFF3B82F6), shape = CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = stepNum.toString(),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column {
                Text(
                    text = title,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = description,
                    fontSize = 12.sp,
                    color = Color.LightGray,
                    lineHeight = 16.sp
                )
            }
        }
    }
}
