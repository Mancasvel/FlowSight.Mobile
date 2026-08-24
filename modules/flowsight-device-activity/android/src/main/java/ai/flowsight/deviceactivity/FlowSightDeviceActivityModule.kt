// FlowSightDeviceActivityModule.kt
//
// Android native module for UsageStatsManager integration.
//
// IMPORTANT: This module requires the user to grant Usage Access permission
// in Android Settings. The permission dialog explains what data is collected
// and how to revoke it.
//
// UsageStatsManager provides:
// - Package names of used apps
// - Total foreground time per app
// - Last time used
// - Number of launches
//
// UsageStatsManager does NOT provide:
// - Window content or titles
// - URLs or browsing history
// - User intent or productivity inference
// - Screenshots of other apps
//
// The app must:
// - Explain what data is collected before requesting permission
// - Provide a way to revoke permission from within the app
// - Handle permission revocation gracefully
// - Not use AccessibilityService for monitoring (Play Store policy)
// - Not maintain wake locks or aggressive polling

package ai.flowsight.deviceactivity

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar

class FlowSightDeviceActivityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FlowSightDeviceActivity")

    // Check if Usage Access permission is granted
    AsyncFunction("isAvailable") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
      mode == AppOpsManager.MODE_ALLOWED
    }

    // Check authorization status
    AsyncFunction("checkAuthorization") {
      val context = appContext.reactContext ?: return@AsyncFunction mapOf(
        "granted" to false,
        "platform" to "android",
        "method" to "usage_stats"
      )

      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )

      mapOf(
        "granted" to (mode == AppOpsManager.MODE_ALLOWED),
        "platform" to "android",
        "method" to "usage_stats"
      )
    }

    // Open Usage Access settings
    AsyncFunction("requestAuthorization") {
      val context = appContext.reactContext ?: return@AsyncFunction mapOf(
        "granted" to false,
        "platform" to "android",
        "method" to "usage_stats"
      )

      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)

      mapOf(
        "granted" to false, // User must manually enable in settings
        "platform" to "android",
        "method" to "usage_stats",
        "settingsOpened" to true
      )
    }

    // Get device activity data
    // Returns package names and usage time
    AsyncFunction("getActivity") { startDateMs: Double, endDateMs: Double ->
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()

      val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
        ?: return@AsyncFunction emptyList<Map<String, Any>>()

      val stats = usageStatsManager.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        startDateMs.toLong(),
        endDateMs.toLong()
      )

      stats?.filter { it.totalTimeInForeground > 0 }?.map { stat ->
        mapOf(
          "packageName" to stat.packageName,
          "usageSeconds" to (stat.totalTimeInForeground / 1000),
          "lastUsed" to stat.lastTimeUsed,
          "appName" to "" // Would need PackageManager to resolve
        )
      } ?: emptyList()
    }
  }
}
