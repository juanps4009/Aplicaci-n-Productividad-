package app.productividad.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.RemoteViews;

import java.util.List;

public class TaskWidgetProvider extends AppWidgetProvider {

    static final String ACTION_REFRESH = "app.productividad.widget.REFRESH";
    /** Extras que viajan al servicio de la lista: qué diseño se dibuja. */
    static final String EXTRA_COMPACT = "compact";
    static final String EXTRA_SHOW_DUE = "showDue";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) update(context, manager, id);
    }

    /** El usuario estiró o achicó el widget: se vuelve a elegir el diseño. */
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, Bundle newOptions) {
        super.onAppWidgetOptionsChanged(context, manager, appWidgetId, newOptions);
        update(context, manager, appWidgetId);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) refreshAll(context);
    }

    static void update(Context context, AppWidgetManager manager, int appWidgetId) {
        // Tamaño actual en dp (0 si el launcher no lo informa: entonces se usa el diseño grande)
        Bundle options = manager.getAppWidgetOptions(appWidgetId);
        int width = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int height = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        boolean compact = TaskLogic.isCompact(width, height);
        boolean showDue = TaskLogic.showDue(width);

        RemoteViews views = new RemoteViews(context.getPackageName(), compact ? R.layout.widget_compact : R.layout.widget);

        // Los extras forman parte de la dirección (setData): cada diseño tiene su propia lista
        Intent service = new Intent(context, TaskWidgetService.class);
        service.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        service.putExtra(EXTRA_COMPACT, compact);
        service.putExtra(EXTRA_SHOW_DUE, showDue);
        service.setData(Uri.parse(service.toUri(Intent.URI_INTENT_SCHEME)));
        views.setRemoteAdapter(R.id.list, service);
        views.setEmptyView(R.id.list, R.id.empty);

        // Tocar una tarea abre OpenTaskActivity (explícita: Android 14 no permite plantillas mutables implícitas),
        // que a su vez abre la app web en esa tarea. Cada fila aporta el id de su tarea.
        PendingIntent template = PendingIntent.getActivity(context, 0, new Intent(context, OpenTaskActivity.class),
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
        int emptyText = compact
                ? (configured ? R.string.widget_empty_short : R.string.widget_empty_unconfigured_short)
                : (configured ? R.string.widget_empty : R.string.widget_empty_unconfigured);
        views.setTextViewText(R.id.empty, context.getString(emptyText));
        Intent config = new Intent(context, ConfigActivity.class);
        views.setOnClickPendingIntent(R.id.empty, PendingIntent.getActivity(context, 2, config,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        // En el compacto, la cabecera lleva el contador con lo último descargado (se corrige al terminar la descarga)
        if (compact) applyCount(context, views, TaskRepo.cachedTasks(context));

        manager.updateAppWidget(appWidgetId, views);
        manager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.list);
    }

    /** «Pendientes · 5»; en rojo si alguna está vencida. */
    private static void applyCount(Context context, RemoteViews views, List<TaskLogic.Task> tasks) {
        String title = context.getString(R.string.widget_title);
        views.setTextViewText(R.id.title, tasks.isEmpty() ? title : title + " · " + tasks.size());
        boolean overdue = TaskLogic.overdueCount(tasks, TaskRepo.today()) > 0;
        views.setTextColor(R.id.title, context.getColor(overdue ? R.color.danger : R.color.text));
    }

    /** Lo llama la lista cuando termina de descargar: corrige el contador del diseño compacto sin redibujar todo. */
    static void updateCount(Context context, int appWidgetId, List<TaskLogic.Task> tasks) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_compact);
        applyCount(context, views, tasks);
        AppWidgetManager.getInstance(context).partiallyUpdateAppWidget(appWidgetId, views);
    }

    /** Vuelve a descargar y dibujar todos los widgets. */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, TaskWidgetProvider.class));
        for (int id : ids) update(context, manager, id);
    }
}
