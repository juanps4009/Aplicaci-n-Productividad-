package app.productividad.widget;

/** Qué servidor usa el widget. Sin dependencias de Android para poder probarlo con Java normal. */
final class ServerChoice {

    private ServerChoice() {}

    /** Dirección efectiva: la de la app si se eligió «usar el servidor de la app» (y existe), si no la propia. */
    static String resolve(boolean useDefault, String custom, String appServer) {
        String app = clean(appServer);
        if (useDefault && !app.isEmpty()) return app;
        return clean(custom);
    }

    /** Sin espacios ni barras finales. */
    static String clean(String url) {
        return url == null ? "" : url.trim().replaceAll("/+$", "");
    }

    static boolean isValidCustom(String url) {
        return clean(url).matches("https://[^/\\s]+(/\\S*)?");
    }

    /** Código con guiones cada 4 caracteres (solo para mostrarlo). */
    static String formatCode(String normalized) {
        if (normalized == null) return "";
        return normalized.replaceAll("(.{4})(?=.)", "$1-");
    }
}
