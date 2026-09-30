package app.productividad.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class TaskWidgetProvider extends AppWidgetProvider {

    static final String ACTION_REFRESH = "app.productividad.widget.REFRESH";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) update(context, manager, id);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) refreshAll(context);
    }

    static void update(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget);

        Intent service = new Intent(context, TaskWidgetService.class);
        service.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        service.setData(Uri.parse(service.toUri(Intent.URI_INTENT_SCHEME)));
        views.setRemoteAdapter(R.id.list, service);
        views.setEmptyView(R.id.list, R.id.empty);

        // Tocar una tarea abre la app web en esa tarea (cada fila aporta su propia dirección)
        PendingIntent template = PendingIntent.getActivity(context, 0, new Intent(Intent.ACTION_VIEW),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
        views.setPendingIntentTemplate(R.id.list, template);

        // ↻ actualiza la lista
        Intent refresh = new Intent(context, TaskWidgetProvider.class).setAction(ACTION_REFRESH);
        views.setOnClickPendingIntent(R.id.refresh, PendingIntent.getBroadcast(context, 0, refresh,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        // El título abre la app
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(TaskRepo.appUrl(context)));
        views.setOnClickPendingIntent(R.id.title, PendingIntent.getActivity(context, 1, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        // Mensaje cuando la lista está vacía: sin configurar, toca para abrir los ajustes
        boolean configured = TaskRepo.isConfigured(context);
        views.setTextViewText(R.id.empty, context.getString(configured ? R.string.widget_empty : R.string.widget_empty_unconfigured));
        Intent config = new Intent(context, ConfigActivity.class);
        views.setOnClickPendingIntent(R.id.empty, PendingIntent.getActivity(context, 2, config,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        manager.updateAppWidget(appWidgetId, views);
        manager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.list);
    }

    /** Vuelve a descargar y dibujar todos los widgets. */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, TaskWidgetProvider.class));
        for (int id : ids) update(context, manager, id);
    }
}
