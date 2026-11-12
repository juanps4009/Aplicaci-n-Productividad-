package app.productividad.widget;

import android.app.Application;

/** Inicia Firebase al arrancar (con la configuración que el servidor dio al activar las llamadas). */
public class App extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        Calls.initFirebase(this);
    }
}
