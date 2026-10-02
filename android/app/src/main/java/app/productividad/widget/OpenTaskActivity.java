package app.productividad.widget;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/**
 * Puente invisible: el widget lo abre al tocar una tarea y desde aquí se abre la app web en esa tarea.
 * Es una actividad explícita porque Android 14 prohíbe plantillas «mutables» con intents implícitos.
 */
public class OpenTaskActivity extends Activity {

    static final String EXTRA_TASK_ID = "taskId";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String id = getIntent() == null ? null : getIntent().getStringExtra(EXTRA_TASK_ID);
        String url = TaskRepo.appUrl(this) + (id == null || id.isEmpty() ? "" : "#task=" + Uri.encode(id));
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (ActivityNotFoundException ignored) {
            // sin navegador instalado: no hay nada que abrir
        }
        finish();
    }
}
