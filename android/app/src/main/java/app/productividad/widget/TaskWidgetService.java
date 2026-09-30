package app.productividad.widget;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class TaskWidgetService extends RemoteViewsService {

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext());
    }

    private static final class Factory implements RemoteViewsFactory {
        private final Context context;
        private List<TaskLogic.Task> tasks = new ArrayList<>();

        Factory(Context context) {
            this.context = context;
        }

        @Override public void onCreate() {}

        /** El sistema lo llama en un hilo aparte: aquí sí se puede usar la red. */
        @Override public void onDataSetChanged() {
            tasks = TaskRepo.load(context);
        }

        @Override public void onDestroy() {
            tasks = new ArrayList<>();
        }

        @Override public int getCount() {
            return tasks.size();
        }

        @Override public RemoteViews getViewAt(int position) {
            RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.widget_item);
            if (position < 0 || position >= tasks.size()) return row;
            TaskLogic.Task t = tasks.get(position);
            LocalDate today = TaskRepo.today();

            row.setTextViewText(R.id.task_title, t.text);
            row.setTextColor(R.id.dot, "high".equals(t.priority) ? 0xFFF87171 : "low".equals(t.priority) ? 0xFF4ADE80 : 0xFFFBBF24);

            String due = TaskLogic.dueLabel(t.due, today);
            if (due.isEmpty()) {
                row.setViewVisibility(R.id.task_due, android.view.View.GONE);
            } else {
                row.setViewVisibility(R.id.task_due, android.view.View.VISIBLE);
                row.setTextViewText(R.id.task_due, due);
                row.setTextColor(R.id.task_due, TaskLogic.isOverdue(t.due, today) ? 0xFFF87171 : 0xFF94A3B8);
            }

            // Al tocar: abrir la app en esta tarea (#task=ID lo entiende la app web)
            Intent fill = new Intent();
            fill.setData(Uri.parse(TaskRepo.appUrl(context) + "#task=" + Uri.encode(t.id)));
            row.setOnClickFillInIntent(R.id.row, fill);
            return row;
        }

        @Override public RemoteViews getLoadingView() {
            return null;
        }

        @Override public int getViewTypeCount() {
            return 1;
        }

        @Override public long getItemId(int position) {
            return position;
        }

        @Override public boolean hasStableIds() {
            return false;
        }
    }
}
