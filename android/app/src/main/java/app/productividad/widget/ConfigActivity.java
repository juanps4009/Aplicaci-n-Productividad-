package app.productividad.widget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

/** Ajustes del widget: dirección del servidor, código de sincronización y dirección de la app. */
public class ConfigActivity extends Activity {

    private int appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Si se abre al añadir el widget y el usuario sale sin guardar, el widget no se añade
        setResult(RESULT_CANCELED);
        setContentView(R.layout.activity_config);

        Intent intent = getIntent();
        if (intent != null && intent.getExtras() != null) {
            appWidgetId = intent.getExtras().getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        }

        final EditText server = findViewById(R.id.server);
        final EditText code = findViewById(R.id.code);
        final EditText appUrl = findViewById(R.id.app_url);
        final TextView error = findViewById(R.id.error);

        server.setText(TaskRepo.prefs(this).getString("server", ""));
        code.setText(TaskRepo.prefs(this).getString("code", ""));
        appUrl.setText(TaskRepo.appUrl(this));

        findViewById(R.id.save).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                String s = server.getText().toString().trim().replaceAll("/+$", "");
                String c = TaskLogic.normalizeCode(code.getText().toString());
                String a = appUrl.getText().toString().trim();
                if (!s.startsWith("https://") || s.length() < 12) {
                    error.setText("La dirección del servidor debe empezar con https://");
                    return;
                }
                if (!TaskLogic.isValidCode(c)) {
                    error.setText("El código debe tener 20 letras y números (por ejemplo K7QM-2XPD-9RVA-4HNT-B3WE).");
                    return;
                }
                if (!a.startsWith("https://")) {
                    error.setText("La dirección de la app debe empezar con https://");
                    return;
                }
                TaskRepo.save(ConfigActivity.this, s, c, a);
                TaskWidgetProvider.refreshAll(ConfigActivity.this);

                if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                    Intent result = new Intent();
                    result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
                    setResult(RESULT_OK, result);
                } else {
                    Toast.makeText(ConfigActivity.this, "Guardado. Ya puedes añadir el widget a tu pantalla de inicio.", Toast.LENGTH_LONG).show();
                }
                finish();
            }
        });
    }
}
