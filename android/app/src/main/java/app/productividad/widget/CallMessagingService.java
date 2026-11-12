package app.productividad.widget;

import android.content.Intent;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Avisos de Firebase. Solo traen un id (el contenido va cifrado en el servidor):
 *  t=call → suena la llamada (CallService); t=msg → notificación con el mensaje de Claude.
 */
public class CallMessagingService extends FirebaseMessagingService {

    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData();
        String type = data.get("t"), id = data.get("id");
        if (id == null || id.isEmpty() || !TaskRepo.isConfigured(this)) return;
        if ("call".equals(type)) {
            Intent extras = new Intent().putExtra(CallService.EXTRA_ID, id).putExtra(CallService.EXTRA_URGENT, "1".equals(data.get("urgent")));
            try {
                CallService.send(this, CallService.ACTION_RING, extras);
            } catch (Exception e) {
                // Android no dejó abrir el servicio (aviso degradado a prioridad normal): queda como llamada perdida
                Calls.notifyMessage(this, id, "Claude intentó llamarte. Abre la app para ver el motivo.");
            }
        } else if ("msg".equals(type)) {
            String text = "";
            try { text = Calls.api(this).messageText(id); } catch (Exception ignored) { }
            Calls.notifyMessage(this, id, text);
        }
    }

    @Override
    public void onNewToken(String token) {
        Calls.onNewToken(this, token);
    }
}
