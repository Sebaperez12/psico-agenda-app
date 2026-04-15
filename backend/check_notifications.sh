#!/bin/bash
# Script para verificar que las notificaciones estén activadas

echo "================================================"
echo "✅ EMAIL Y WHATSAPP - VERIFICACIÓN DE SETUP"
echo "================================================"
echo ""

echo "1. Verificando Python..."
python --version

echo ""
echo "2. Verificando dependencias..."
python -c "import flask_mail; print('   ✅ Flask-Mail instalada')" 2>/dev/null || echo "   ❌ Flask-Mail NO instalada"
python -c "import twilio; print('   ✅ Twilio instalada')" 2>/dev/null || echo "   ❌ Twilio NO instalada"

echo ""
echo "3. Verificando app.py..."
python -c "import app; print('   ✅ app.py cargado correctamente')" 2>/dev/null || echo "   ❌ Error en app.py"

echo ""
echo "4. Verificando .env..."
if [ -f ".env" ]; then
    echo "   ✅ Archivo .env encontrado"
    if grep -q "MAIL_USERNAME" .env; then
        echo "   ✅ Variables MAIL_* configuradas"
    else
        echo "   ⚠️  Variables MAIL_* no configuradas"
    fi
    if grep -q "TWILIO_ACCOUNT_SID" .env; then
        echo "   ✅ Variables TWILIO_* configuradas"
    else
        echo "   ⚠️  Variables TWILIO_* no configuradas"
    fi
    if grep -q "REMINDER_JOB_KEY" .env; then
        echo "   ✅ REMINDER_JOB_KEY configurada"
    else
        echo "   ⚠️  REMINDER_JOB_KEY no configurada"
    fi
    if grep -q "BACKEND_BASE_URL" .env; then
        echo "   ✅ BACKEND_BASE_URL configurada"
    else
        echo "   ⚠️  BACKEND_BASE_URL no configurada (se usará http://127.0.0.1:5000)"
    fi
else
    echo "   ⚠️  Archivo .env NO encontrado"
    echo "   → Copia .env.example a .env y configura las credenciales"
fi

echo ""
echo "================================================"
echo "PRÓXIMOS PASOS:"
echo "================================================"
echo "1. Copia .env.example a .env"
echo "2. Configura MAIL_* (Gmail o Outlook)"
echo "3. Configura TWILIO_* (opcional, para WhatsApp)"
echo "4. Configura REMINDER_JOB_KEY y BACKEND_BASE_URL"
echo "5. Inicia el backend: python app.py"
echo "6. En la UI: Turnos → turno reservado → Click Notificar"
echo "7. Para recordatorios automáticos: ./run_automatic_reminders.sh"
echo ""
