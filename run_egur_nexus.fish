#!/usr/bin/fish
# Script para iniciar Egur-Nexus (Vite + React) en puerto 3010 y autolimpiar al cerrar

set DIR "/home/gustavosanabria/proyectos_ia/egur_nexus"
cd $DIR

set VITE_STARTED 0

# 1. Iniciar Vite en puerto 3010 si no está corriendo
if not lsof -i :3010 -t >/dev/null
    echo "➔ Iniciando frontend de Egur-Nexus en puerto 3010..."
    nohup npm run dev -- --port 3010 > vite_dev.log 2>&1 &
    set VITE_STARTED 1
    
    # Esperar hasta que esté activo (máximo 10 segundos)
    for i in (seq 1 20)
        if lsof -i :3010 -t >/dev/null
            break
        end
        sleep 0.5
    end
    echo "✓ Servidor Vite listo."
else
    echo "✓ Servidor Vite ya activo en puerto 3010."
end

# 2. Lanzar navegador Firefox con identidad dedicada (bloqueante para esperar el cierre)
if type -q firefox
    echo "➔ Abriendo Egur-Nexus en Firefox (bloqueante)..."
    # Limpiamos el perfil anterior para evitar cacheado de peticiones u otros datos persistidos
    rm -rf "$DIR/.firefox-profile"
    mkdir -p "$DIR/.firefox-profile"
    
    # Ejecutamos en primer plano para esperar a que el usuario cierre la ventana.
    # --class EgurNexus permite configurar reglas de ventana flotante o workspaces en Hyprland.
    firefox --class EgurNexus --name EgurNexus --no-remote --profile "$DIR/.firefox-profile" "http://localhost:3010"
    
    echo "➔ Ventana de Egur-Nexus cerrada."
else if type -q xdg-open
    xdg-open "http://localhost:3010"
    echo "➔ Abierto vía xdg-open. Esperando 10 segundos..."
    sleep 10
else
    echo "➔ Abre http://localhost:3010 en tu navegador."
end

# 3. Limpieza de servicios si nosotros los levantamos
if test $VITE_STARTED -eq 1
    echo "➔ Deteniendo servidor de desarrollo de Vite..."
    set PIDS (lsof -t -i :3010)
    if test -n "$PIDS"
        kill -9 $PIDS
        echo "✓ Servidor Vite detenido en puerto 3010."
    end
end
