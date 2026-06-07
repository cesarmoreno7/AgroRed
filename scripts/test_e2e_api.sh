#!/bin/bash

# Script de Pruebas E2E - API Backend
# Ejecución: ./scripts/test_e2e_api.sh

BASE_URL="http://localhost:8000/api" # Ajusta el puerto si es necesario
TOKEN="TU_TOKEN_DE_ADMIN_AQUI" # Reemplaza con un token válido de administrador

echo "🚀 Iniciando Pruebas de Punta a Punta (API)..."
echo "================================================"

# Función para hacer request y validar respuesta
test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4
    
    echo -n "Probando $description... "
    
    if [ "$method" == "GET" ]; then
        status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint")
    else
        # Para POST/PUT/DELETE se requiere autenticación (ejemplo simplificado)
        status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json")
    fi

    if [ "$status" == "$expected_status" ]; then
        echo "✅ OK ($status)"
        return 0
    else
        echo "❌ FALLÓ (Esperado: $expected_status, Obtenido: $status)"
        return 1
    fi
}

# 1. Pruebas de Tablas Maestras (Localización)
echo ""
echo "📍 Módulo: Localización (Tablas Maestras)"
test_endpoint "GET" "/departamentos/" "200" "Listar Departamentos"
test_endpoint "GET" "/municipios/" "200" "Listar Municipios"
test_endpoint "GET" "/corregimientos/" "200" "Listar Corregimientos"
test_endpoint "GET" "/veredas/" "200" "Listar Veredas"

# 2. Pruebas de Usuarios y Roles
echo ""
echo "👤 Módulo: Usuarios y Roles"
test_endpoint "GET" "/users/" "200" "Listar Usuarios"
# Nota: Crear usuario requiere body JSON, se omite en este script básico sin payload

# 3. Pruebas de Productos e Inventario
echo ""
echo "📦 Módulo: Productos e Inventario"
test_endpoint "GET" "/products/" "200" "Listar Productos"
test_endpoint "GET" "/inventory/" "200" "Listar Inventario"

# 4. Prueba de Copiloto IA (Si está implementado el endpoint)
echo ""
echo "🤖 Módulo: Copiloto IA"
test_endpoint "POST" "/ai-copilot/chat" "200" "Endpoint Copiloto IA" 
# Nota: Este test fallará si el endpoint aún no acepta POST sin body, es referencial.

echo ""
echo "================================================"
echo "🏁 Pruebas de API finalizadas."
echo "Si ves ❌, revisa los logs del backend o la conexión a la BD."
