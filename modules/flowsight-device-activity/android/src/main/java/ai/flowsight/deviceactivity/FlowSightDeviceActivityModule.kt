package ai.flowsight.deviceactivity

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar

/**
 * Local-only bridge to Android's UsageStatsManager.
 *
 * FlowSight reads foreground app durations only for a focus-session window.
 * It never uses AccessibilityService, records screen contents, or uploads the
 * per-app rows returned by this module.
 */
class FlowSightDeviceActivityModule : Module() {
  private val preferencesName = "flowsight_usage_session"
  private val startKey = "start_ms"
  private val endKey = "end_ms"

  override fun definition() = ModuleDefinition {
    Name("FlowSightDeviceActivity")

    AsyncFunction("isAvailable") {
      appContext.reactContext != null
    }

    AsyncFunction("checkAuthorization") {
      permissionResult(appContext.reactContext)
    }

    AsyncFunction("requestAuthorization") {
      val context = appContext.reactContext
        ?: return@AsyncFunction permissionResult(null)

      val appSpecificIntent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        data = Uri.parse("package:${context.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      val generalIntent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }

      runCatching { context.startActivity(appSpecificIntent) }
        .recoverCatching { context.startActivity(generalIntent) }

      permissionResult(context) + mapOf("settingsOpened" to true)
    }

    AsyncFunction("hasSelection") {
      true
    }

    AsyncFunction("presentActivityPicker") {
      val context = appContext.reactContext
        ?: return@AsyncFunction mapOf("saved" to false)
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      runCatching { context.startActivity(intent) }
      mapOf("saved" to hasUsageAccess(context))
    }

    AsyncFunction("startSessionMonitoring") {
      val context = appContext.reactContext
        ?: return@AsyncFunction mapOf(
          "started" to false,
          "startMs" to System.currentTimeMillis().toDouble(),
          "error" to "context_unavailable"
        )
      val preferences = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
      val savedStartMs = preferences.getLong(startKey, 0L)
      val savedEndMs = preferences.getLong(endKey, 0L)
      val hasOpenWindow = savedStartMs > 0L && savedEndMs <= savedStartMs
      val startMs = if (hasOpenWindow) savedStartMs else System.currentTimeMillis()
      if (!hasOpenWindow) {
        preferences.edit()
          .putLong(startKey, startMs)
          .remove(endKey)
          .apply()
      }
      val granted = hasUsageAccess(context)

      mapOf(
        "started" to granted,
        "startMs" to startMs.toDouble(),
        "error" to if (granted) null else "usage_access_required"
      )
    }

    AsyncFunction("stopSessionMonitoring") {
      val context = appContext.reactContext
      val endMs = System.currentTimeMillis()
      if (context == null) {
        return@AsyncFunction mapOf(
          "stopped" to false,
          "startMs" to 0.0,
          "endMs" to endMs.toDouble()
        )
      }

      val preferences = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
      val startMs = preferences.getLong(startKey, 0L)
      preferences.edit().putLong(endKey, endMs).apply()
      mapOf(
        "stopped" to (startMs > 0L),
        "startMs" to startMs.toDouble(),
        "endMs" to endMs.toDouble()
      )
    }

    AsyncFunction("getLastSessionWindow") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      val preferences = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
      val startMs = preferences.getLong(startKey, 0L)
      val endMs = preferences.getLong(endKey, 0L)
      if (startMs <= 0L || endMs <= startMs) {
        null
      } else {
        mapOf("startMs" to startMs.toDouble(), "endMs" to endMs.toDouble())
      }
    }

    AsyncFunction("getActivity") { startDateMs: Double, endDateMs: Double ->
      val context = appContext.reactContext
        ?: return@AsyncFunction emptyList<Map<String, Any>>()
      val startMs = startDateMs.toLong()
      val endMs = endDateMs.toLong()
      if (!hasUsageAccess(context) || startMs <= 0L || endMs <= startMs) {
        return@AsyncFunction emptyList<Map<String, Any>>()
      }
      collectUsage(context, startMs, endMs)
    }

    AsyncFunction("getHourlyActivity") { startDateMs: Double, endDateMs: Double ->
      val context = appContext.reactContext
        ?: return@AsyncFunction emptyList<Map<String, Any>>()
      val startMs = startDateMs.toLong()
      val endMs = endDateMs.toLong()
      if (!hasUsageAccess(context) || startMs <= 0L || endMs <= startMs) {
        return@AsyncFunction emptyList<Map<String, Any>>()
      }
      collectHourlyUsage(context, startMs, endMs)
    }

    AsyncFunction("getTrackingStatus") {
      val context = appContext.reactContext
      mapOf(
        "isTracking" to (context != null && hasUsageAccess(context)),
        "platform" to "android",
        "method" to "usage_stats"
      )
    }
  }

  private fun permissionResult(context: Context?): Map<String, Any> {
    val granted = context != null && hasUsageAccess(context)
    return mapOf(
      "granted" to granted,
      "platform" to "android",
      "method" to "usage_stats",
      "status" to if (granted) "approved" else "notGranted"
    )
  }

  @Suppress("DEPRECATION")
  private fun hasUsageAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
    } else {
      appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun collectUsage(
    context: Context,
    startMs: Long,
    endMs: Long
  ): List<Map<String, Any>> {
    val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
      ?: return emptyList()

    val dayStart = Calendar.getInstance().apply {
      timeInMillis = startMs
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }.timeInMillis

    val activeSince = mutableMapOf<String, Long>()
    val totals = mutableMapOf<String, Long>()
    val lastUsed = mutableMapOf<String, Long>()
    val homePackageName = context.packageManager.resolveActivity(
      Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME),
      android.content.pm.PackageManager.MATCH_DEFAULT_ONLY
    )?.activityInfo?.packageName
    val events = manager.queryEvents(dayStart, endMs)
    val event = UsageEvents.Event()

    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val packageName = event.packageName ?: continue
      if (packageName == context.packageName || packageName == homePackageName) continue

      when (event.eventType) {
        UsageEvents.Event.ACTIVITY_RESUMED -> {
          if (event.timeStamp < startMs) {
            activeSince[packageName] = startMs
          } else if (!activeSince.containsKey(packageName)) {
            activeSince[packageName] = event.timeStamp.coerceAtLeast(startMs)
          }
          lastUsed[packageName] = event.timeStamp
        }
        UsageEvents.Event.ACTIVITY_PAUSED,
        UsageEvents.Event.ACTIVITY_STOPPED -> {
          val foregroundAt = activeSince.remove(packageName) ?: continue
          val stoppedAt = event.timeStamp.coerceIn(startMs, endMs)
          if (stoppedAt > foregroundAt) {
            totals[packageName] = (totals[packageName] ?: 0L) + (stoppedAt - foregroundAt)
            lastUsed[packageName] = stoppedAt
          }
        }
      }
    }

    for ((packageName, foregroundAt) in activeSince) {
      if (endMs > foregroundAt) {
        totals[packageName] = (totals[packageName] ?: 0L) + (endMs - foregroundAt)
        lastUsed[packageName] = endMs
      }
    }

    return totals.entries
      .asSequence()
      .filter { it.value >= 1_000L }
      .sortedByDescending { it.value }
      .map { (packageName, durationMs) ->
        val applicationName = applicationName(context, packageName)

        mapOf(
          "packageName" to packageName,
          "appName" to applicationName,
          "usageSeconds" to (durationMs / 1_000L).toDouble(),
          "lastUsed" to (lastUsed[packageName] ?: endMs).toDouble()
        )
      }
      .toList()
  }

  private fun collectHourlyUsage(
    context: Context,
    startMs: Long,
    endMs: Long
  ): List<Map<String, Any>> {
    val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
      ?: return emptyList()
    val dayStart = Calendar.getInstance().apply {
      timeInMillis = startMs
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }.timeInMillis
    val homePackageName = context.packageManager.resolveActivity(
      Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME),
      android.content.pm.PackageManager.MATCH_DEFAULT_ONLY
    )?.activityInfo?.packageName
    val activeSince = mutableMapOf<String, Long>()
    val totals = mutableMapOf<Pair<Int, String>, Long>()
    val lastUsed = mutableMapOf<String, Long>()

    fun addInterval(packageName: String, rawStart: Long, rawEnd: Long) {
      var cursor = rawStart.coerceAtLeast(startMs)
      val stop = rawEnd.coerceAtMost(endMs)
      while (cursor < stop) {
        val calendar = Calendar.getInstance().apply {
          timeInMillis = cursor
        }
        val hour = calendar.get(Calendar.HOUR_OF_DAY)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        calendar.add(Calendar.HOUR_OF_DAY, 1)
        val sliceEnd = minOf(stop, calendar.timeInMillis)
        val key = hour to packageName
        totals[key] = (totals[key] ?: 0L) + (sliceEnd - cursor)
        cursor = sliceEnd
      }
    }

    val events = manager.queryEvents(dayStart, endMs)
    val event = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val packageName = event.packageName ?: continue
      if (packageName == context.packageName || packageName == homePackageName) continue

      when (event.eventType) {
        UsageEvents.Event.ACTIVITY_RESUMED -> {
          if (event.timeStamp < startMs) {
            activeSince[packageName] = startMs
          } else if (!activeSince.containsKey(packageName)) {
            activeSince[packageName] = event.timeStamp.coerceAtLeast(startMs)
          }
          lastUsed[packageName] = event.timeStamp
        }
        UsageEvents.Event.ACTIVITY_PAUSED,
        UsageEvents.Event.ACTIVITY_STOPPED -> {
          val foregroundAt = activeSince.remove(packageName) ?: continue
          val stoppedAt = event.timeStamp.coerceIn(startMs, endMs)
          if (stoppedAt > foregroundAt) addInterval(packageName, foregroundAt, stoppedAt)
          lastUsed[packageName] = stoppedAt
        }
      }
    }

    for ((packageName, foregroundAt) in activeSince) {
      if (endMs > foregroundAt) addInterval(packageName, foregroundAt, endMs)
      lastUsed[packageName] = endMs
    }

    return totals.entries
      .asSequence()
      .filter { it.value >= 1_000L }
      .sortedWith(compareBy<Map.Entry<Pair<Int, String>, Long>> { it.key.first }.thenByDescending { it.value })
      .map { (key, durationMs) ->
        val (hour, packageName) = key
        mapOf(
          "hour" to hour,
          "packageName" to packageName,
          "appName" to applicationName(context, packageName),
          "usageSeconds" to (durationMs / 1_000L).toDouble(),
          "lastUsed" to (lastUsed[packageName] ?: endMs).toDouble()
        )
      }
      .toList()
  }

  private fun applicationName(context: Context, packageName: String): String {
    val packageManager = context.packageManager
    return runCatching {
      val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        packageManager.getApplicationInfo(
          packageName,
          android.content.pm.PackageManager.ApplicationInfoFlags.of(0)
        )
      } else {
        @Suppress("DEPRECATION")
        packageManager.getApplicationInfo(packageName, 0)
      }
      packageManager.getApplicationLabel(info).toString()
    }.getOrDefault(packageName)
  }
}
