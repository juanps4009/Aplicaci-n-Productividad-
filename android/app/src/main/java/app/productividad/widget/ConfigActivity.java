package app.productividad.widget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Pantalla de ajustes del widget. Se abre al añadir el widget, desde el icono de la app y desde el
 * botón «Conectar el widget» de la app web (enlace pendientes://link?code=…).
 * Eliges «usar el servidor de la app» (un toque, sin escribir direcciones) o tu propio servidor,
 * y pegas tu código de sincronización.
 */
public class ConfigActivity extends Activity {

    private int appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private boolean useDefault = true;

    private View cardDefault, cardCustom;
    private TextView markDefault, markCustom, error;
    private EditText server, code;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Si se abre al añadir el widget y la persona sale sin guardar, el widget no se añade
        setResult(RESULT_CANCELED);

        // Abierto desde el botón de la app web: guardar lo recibido y terminar
        Uri link = getIntent() == null ? null : getIntent().getData();
        if (link != null && "pendientes".equals(link.getScheme()) && "call".equals(link.getHost())) {
            // «Llamar a Claude» desde la app web (pendientes://call): abre la pantalla de llamada con altavoz, silencio y colgar
            startActivity(new Intent(this, CallActivity.class).setAction(CallService.ACTION_OUTGOING));
            finish();
            return;
        }
        if (link != null && "pendientes".equals(link.getScheme())) {
            Toast.makeText(this, applyLink(link)
                    ? "Widget conectado ✓ Ahora mantén pulsada tu pantalla de inicio → Widgets → Pendientes."
                    : "El enlace no es válido. Vuelve a tocar «Conectar el widget» en la app.", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        setContentView(R.layout.activity_config);

        Intent intent = getIntent();
        if (intent != null && intent.getExtras() != null) {
            appWidgetId = intent.getExtras().getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        }

        cardDefault = findViewById(R.id.card_default);
        cardCustom = findViewById(R.id.card_custom);
        markDefault = findViewById(R.id.mark_default);
        markCustom = findViewById(R.id.mark_custom);
        error = findViewById(R.id.error);
        server = findViewById(R.id.server);
        code = findViewById(R.id.code);

        // Estado inicial: lo guardado; la primera vez, «usar el servidor de la app» si existe
        boolean configured = TaskRepo.prefs(this).contains("useDefault");
        useDefault = TaskRepo.hasAppServer() && (!configured || TaskRepo.prefs(this).getBoolean("useDefault", true));
        server.setText(TaskRepo.prefs(this).getString("server", ""));
        code.setText(ServerChoice.formatCode(TaskRepo.prefs(this).getString("code", "")));
        if (!TaskRepo.hasAppServer()) cardDefault.setVisibility(View.GONE); // sin servidor de la app solo queda el propio
        showChoice();

        cardDefault.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { useDefault = true; showChoice(); }
        });
        cardCustom.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { useDefault = false; showChoice(); }
        });

        // El código se muestra con guiones mientras se escribe
        code.addTextChangedListener(new TextWatcher() {
            private boolean busy;
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void afterTextChanged(Editable e) {
                if (busy) return;
                busy = true;
                String normalized = TaskLogic.normalizeCode(e.toString());
                if (normalized.length() > 20) normalized = normalized.substring(0, 20);
                String shown = ServerChoice.formatCode(normalized);
                if (!shown.equals(e.toString())) { e.replace(0, e.length(), shown); }
                busy = false;
            }
        });

        findViewById(R.id.paste).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                ClipData clip = cm == null ? null : cm.getPrimaryClip();
                if (clip == null || clip.getItemCount() == 0) {
                    error.setText("No hay nada copiado. Copia tu código en la app y vuelve aquí.");
                    return;
                }
                code.setText(clip.getItemAt(0).coerceToText(ConfigActivity.this));
                code.setSelection(code.getText().length());
                error.setText("");
            }
        });

        findViewById(R.id.save).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { save(); }
        });

        setupCalls();
    }

    /* ---------- Llamadas con Claude ---------- */
    private static final int REQ_CALL_PERMS = 31;
    private TextView callsStatus;
    private View callsActivate, callsFullscreen, callsCall, callsOff;

    private void setupCalls() {
        callsStatus = findViewById(R.id.calls_status);
        callsActivate = findViewById(R.id.calls_activate);
        callsFullscreen = findViewById(R.id.calls_fullscreen);
        callsCall = findViewById(R.id.calls_call);
        callsOff = findViewById(R.id.calls_off);
        callsActivate.setOnClickListener(v -> activateCalls());
        callsFullscreen.setOnClickListener(v -> {
            try { startActivity(Calls.fullScreenSettings(this)); } catch (Exception e) { startActivity(new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName())); }
        });
        callsCall.setOnClickListener(v -> startActivity(new Intent(this, CallActivity.class).setAction(CallService.ACTION_OUTGOING)));
        callsOff.setOnClickListener(v -> {
            callsStatus.setText("Desactivando…");
            Calls.deactivate(this, err -> runOnUiThread(() -> { renderCalls(); if (err != null) callsStatus.setText(err); }));
        });
        renderCalls();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (callsStatus != null) renderCalls();
    }

    private void renderCalls() {
        boolean configured = TaskRepo.isConfigured(this), on = Calls.isEnabled(this);
        boolean missingPerms = Calls.missingRuntimePermissions(this).length > 0;
        if (!configured) callsStatus.setText("Primero guarda tu código arriba.");
        else if (!on) callsStatus.setText("Desactivadas en este celular.");
        else if (missingPerms) callsStatus.setText("Activadas, pero falta dar permiso de micrófono o de notificaciones.");
        else if (Calls.needsFullScreenPermission(this)) callsStatus.setText("Activadas ✓ Falta un permiso para que la llamada aparezca con el celular bloqueado.");
        else callsStatus.setText("Activadas ✓ Claude ya puede llamarte.");
        callsActivate.setVisibility(configured && (!on || missingPerms) ? View.VISIBLE : View.GONE);
        ((TextView) callsActivate).setText(on ? "Dar permisos" : "Activar llamadas");
        callsFullscreen.setVisibility(configured && on && Calls.needsFullScreenPermission(this) ? View.VISIBLE : View.GONE);
        callsCall.setVisibility(configured ? View.VISIBLE : View.GONE);
        callsOff.setVisibility(on ? View.VISIBLE : View.GONE);
    }

    private void activateCalls() {
        String[] missing = Calls.missingRuntimePermissions(this);
        if (missing.length > 0) { requestPermissions(missing, REQ_CALL_PERMS); return; }
        callsStatus.setText("Activando…");
        callsActivate.setEnabled(false);
        Calls.activate(this, err -> runOnUiThread(() -> {
            callsActivate.setEnabled(true);
            renderCalls();
            if (err != null) callsStatus.setText(err);
            else Toast.makeText(this, "Llamadas activadas ✓", Toast.LENGTH_LONG).show();
        }));
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        if (requestCode != REQ_CALL_PERMS) return;
        if (Calls.missingRuntimePermissions(this).length > 0) {
            callsStatus.setText("Sin permiso de micrófono y notificaciones no se pueden recibir llamadas. Puedes darlos en Ajustes → Apps → Pendientes (widget) → Permisos.");
            return;
        }
        activateCalls();
    }

    /** Marca la tarjeta elegida y muestra el campo de dirección solo para el servidor propio. */
    private void showChoice() {
        cardDefault.setSelected(useDefault);
        cardCustom.setSelected(!useDefault);
        markDefault.setText(useDefault ? "●" : "○");
        markCustom.setText(useDefault ? "○" : "●");
        server.setVisibility(useDefault ? View.GONE : View.VISIBLE);
        error.setText("");
    }

    private void save() {
        String customServer = ServerChoice.clean(server.getText().toString());
        String normalized = TaskLogic.normalizeCode(code.getText().toString());
        if (!useDefault && !ServerChoice.isValidCustom(customServer)) {
            error.setText("Escribe la dirección de tu servidor completa, empezando con https://");
            return;
        }
        if (!TaskLogic.isValidCode(normalized)) {
            error.setText("El código debe tener 20 letras y números (por ejemplo K7QM-2XPD-9RVA-4HNT-B3WE).");
            return;
        }
        TaskRepo.save(this, useDefault, customServer, normalized, TaskRepo.appUrl(this));
        TaskWidgetProvider.refreshAll(this);

        if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            Intent result = new Intent();
            result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
            setResult(RESULT_OK, result);
        } else {
            Toast.makeText(this, "Guardado ✓ Ya puedes añadir el widget a tu pantalla de inicio.", Toast.LENGTH_LONG).show();
        }
        finish();
    }

    /** Guarda lo que viene en el enlace de la app web. Devuelve false si falta el código o es inválido. */
    private boolean applyLink(Uri link) {
        String code = TaskLogic.normalizeCode(link.getQueryParameter("code"));
        String linkServer = ServerChoice.clean(link.getQueryParameter("server"));
        String app = String.valueOf(link.getQueryParameter("app")).trim();
        if (!TaskLogic.isValidCode(code)) return false;
        if (!app.startsWith("https://")) app = TaskRepo.DEFAULT_APP_URL;
        // Si el enlace trae el mismo servidor que el de la app, se usa «el servidor de la app»; si no, se guarda como propio
        boolean sameAsApp = TaskRepo.hasAppServer() && linkServer.equals(ServerChoice.clean(BuildConfig.DEFAULT_SERVER));
        boolean useApp = TaskRepo.hasAppServer() && (linkServer.isEmpty() || sameAsApp);
        if (!useApp && !ServerChoice.isValidCustom(linkServer)) return false;
        TaskRepo.save(this, useApp, useApp ? "" : linkServer, code, app);
        TaskWidgetProvider.refreshAll(this);
        return true;
    }
}
