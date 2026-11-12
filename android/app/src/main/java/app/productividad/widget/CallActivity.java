package app.productividad.widget;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Pantalla de la llamada. Se muestra encima de la pantalla de bloqueo cuando Claude llama, y se abre con
 * «Llamar a Claude» (en los ajustes del widget o manteniendo pulsado el icono). La llamada vive en CallService.
 */
public class CallActivity extends Activity implements CallService.Ui {

    static final String ACTION_SHOW = "app.productividad.widget.SHOW_CALL";
    private static final int REQ_MIC = 21;

    private TextView name, status, reason, transcript;
    private ScrollView scroll;
    private View rowRinging, rowTalking, close;
    private TextView mute, speaker;
    private String pendingAction; // contestar o llamar, esperando el permiso del micrófono

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setContentView(R.layout.activity_call);
        name = findViewById(R.id.call_name);
        status = findViewById(R.id.call_status);
        reason = findViewById(R.id.call_reason);
        transcript = findViewById(R.id.call_transcript);
        scroll = findViewById(R.id.call_scroll);
        rowRinging = findViewById(R.id.row_ringing);
        rowTalking = findViewById(R.id.row_talking);
        close = findViewById(R.id.btn_close);
        mute = findViewById(R.id.btn_mute);
        speaker = findViewById(R.id.btn_speaker);

        findViewById(R.id.btn_answer).setOnClickListener(v -> start(CallService.ACTION_ANSWER));
        findViewById(R.id.btn_decline).setOnClickListener(v -> CallService.send(this, CallService.ACTION_DECLINE, null));
        findViewById(R.id.btn_hangup).setOnClickListener(v -> CallService.send(this, CallService.ACTION_HANGUP, null));
        mute.setOnClickListener(v -> CallService.send(this, CallService.ACTION_MUTE, null));
        speaker.setOnClickListener(v -> CallService.send(this, CallService.ACTION_SPEAKER, null));
        close.setOnClickListener(v -> finish());
        handle(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handle(intent);
    }

    private void handle(Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (CallService.ACTION_ANSWER.equals(action) || CallService.ACTION_OUTGOING.equals(action)) start(action);
    }

    /** Contestar o llamar: primero que todo esté listo y el permiso del micrófono. */
    private void start(String action) {
        if (CallService.ACTION_OUTGOING.equals(action)) {
            if (!TaskRepo.isConfigured(this)) {
                Toast.makeText(this, "Primero conecta el widget con tu código.", Toast.LENGTH_LONG).show();
                startActivity(new Intent(this, ConfigActivity.class));
                finish();
                return;
            }
            CallService s = CallService.current;
            if (s != null && s.phase != CallService.Phase.ENDED) { render(); return; } // ya hay una llamada
        }
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingAction = action;
            requestPermissions(new String[] { android.Manifest.permission.RECORD_AUDIO }, REQ_MIC);
            return;
        }
        CallService.send(this, action, null);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        if (requestCode != REQ_MIC || pendingAction == null) return;
        String action = pendingAction;
        pendingAction = null;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) CallService.send(this, action, null);
        else Toast.makeText(this, "Sin permiso de micrófono no se puede hablar con Claude.", Toast.LENGTH_LONG).show();
    }

    @Override
    protected void onResume() {
        super.onResume();
        CallService.ui = this;
        render();
    }

    @Override
    protected void onPause() {
        if (CallService.ui == this) CallService.ui = null;
        super.onPause();
    }

    @Override
    public void onCallChanged() {
        render();
    }

    private void render() {
        CallService s = CallService.current;
        if (s == null) {
            if (pendingAction == null && rowTalking.getVisibility() != View.VISIBLE && status.getText().length() == 0) {
                status.setText("Conectando…");
            }
            rowRinging.setVisibility(View.GONE);
            rowTalking.setVisibility(View.GONE);
            close.setVisibility(View.VISIBLE);
            return;
        }
        name.setText(s.fromClaude ? "Claude" : "Llamada a Claude");
        status.setText(s.error != null && s.phase != CallService.Phase.ENDED ? s.error : s.status);
        String r = s.fromClaude ? s.reason : "Pregúntale por tus pendientes o déjale un encargo a Claude.";
        reason.setText(r);
        reason.setVisibility(r.isEmpty() ? View.GONE : View.VISIBLE);
        String t = s.transcript.text();
        if (!t.equals(transcript.getText().toString())) {
            transcript.setText(t);
            scroll.post(() -> scroll.fullScroll(View.FOCUS_DOWN));
        }
        rowRinging.setVisibility(s.phase == CallService.Phase.RINGING ? View.VISIBLE : View.GONE);
        boolean live = s.phase == CallService.Phase.CONNECTING || s.phase == CallService.Phase.TALKING;
        rowTalking.setVisibility(live ? View.VISIBLE : View.GONE);
        close.setVisibility(s.phase == CallService.Phase.ENDED ? View.VISIBLE : View.GONE);
        mute.setSelected(s.muted);
        mute.setText(s.muted ? "Silenciado" : "Silenciar");
        speaker.setSelected(s.speaker);
        mute.setTextColor(getColor(s.muted ? R.color.on_accent : R.color.text));
        speaker.setTextColor(getColor(s.speaker ? R.color.on_accent : R.color.text));
    }
}
