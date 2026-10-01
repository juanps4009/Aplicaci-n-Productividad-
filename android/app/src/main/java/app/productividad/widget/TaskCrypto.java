package app.productividad.widget;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Descifrado de extremo a extremo, idéntico al de la app web (sync.js):
 * clave = HKDF-SHA256(código normalizado, sal "pendientes-sync-v2", info "enc-aes-256-gcm", 32 bytes);
 * registro = "e1:" + base64url(iv[12] + cifrado AES-GCM) con "id|col" como datos autenticados.
 */
final class TaskCrypto {

    private TaskCrypto() {}

    private static byte[] hmac(byte[] key, byte[] data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data);
    }

    static byte[] deriveKey(String code) throws Exception {
        byte[] ikm = TaskLogic.normalizeCode(code).getBytes(StandardCharsets.UTF_8);
        byte[] salt = "pendientes-sync-v2".getBytes(StandardCharsets.UTF_8);
        byte[] info = "enc-aes-256-gcm".getBytes(StandardCharsets.UTF_8);
        byte[] prk = hmac(salt, ikm);                       // HKDF-Extract
        byte[] block = new byte[info.length + 1];           // HKDF-Expand, primer bloque (32 bytes bastan)
        System.arraycopy(info, 0, block, 0, info.length);
        block[info.length] = 1;
        return hmac(prk, block);
    }

    /** Texto descifrado, o null si no se puede (clave distinta o dato alterado). Sin prefijo "e1:" se devuelve tal cual (formato antiguo). */
    static String decrypt(byte[] key, String data, String aad) {
        if (data == null || !data.startsWith("e1:")) return data;
        try {
            byte[] raw = Base64.getUrlDecoder().decode(data.substring(3));
            if (raw.length < 13) return null;
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, raw, 0, 12));
            cipher.updateAAD(aad.getBytes(StandardCharsets.UTF_8));
            return new String(cipher.doFinal(raw, 12, raw.length - 12), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }
}
