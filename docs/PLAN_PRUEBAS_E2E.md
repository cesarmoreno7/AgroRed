# 🧪 Plan de Pruebas de Punta a Punta (E2E)

Este documento detalla los pasos para validar la funcionalidad completa del sistema.

## 1. Prerrequisitos

- [ ] Backend PHP corriendo en `http://localhost:8000` (o el puerto configurado).
- [ ] Base de datos PostgreSQL con las tablas maestras creadas (`departamentos`, `municipios`, `corregimientos`, `veredas`).
- [ ] Frontend React corriendo en `http://localhost:3000` (o el puerto configurado).
- [ ] Usuario administrador o superusuario creado en la BD.

## 2. Ejecución de Scripts Automatizados

### Backend API
Ejecuta el script de prueba de endpoints:
```bash
cd /workspace
chmod +x scripts/test_e2e_api.sh
./scripts/test_e2e_api.sh
```
*Nota: Edita el archivo para poner tu TOKEN válido antes de ejecutar.*

### Frontend Tests
Ejecuta las pruebas unitarias/integración:
```bash
cd apps/web-dashboard
npm test -- src/__tests__/e2e.test.tsx
```

## 3. Checklist de Validación Manual

### A. Tablas Maestras (Localización)
- [ ] **Departamentos**: 
  - [ ] Listado muestra datos correctamente.
  - [ ] Botón "Nuevo" abre formulario.
  - [ ] Crear nuevo departamento funciona.
  - [ ] Editar y Eliminar funcionan.
- [ ] **Municipios**:
  - [ ] Dropdown de "Departamento" carga opciones.
  - [ ] Al seleccionar departamento, filtra o permite guardar FK correcta.
  - [ ] CRUD completo funcional.
- [ ] **Corregimientos**:
  - [ ] Dropdown de "Municipio" carga opciones.
  - [ ] CRUD completo funcional.
- [ ] **Veredas**:
  - [ ] Dropdown de "Municipio" carga opciones.
  - [ ] CRUD completo funcional.

### B. Productos e Inventario
- [ ] Listado de productos muestra información del inventario.
- [ ] Formulario de producto tiene dropdowns correctos (Unidad de Medida, Categoría, etc.).
- [ ] Crear/Editar producto actualiza inventario correctamente.

### C. Superusuario y Dashboard
- [ ] Login con credenciales de Superusuario.
- [ ] Acceso al Dashboard principal con gráficos/filtros.
- [ ] Filtros por Departamento/Municipio responden correctamente.
- [ ] Menú muestra opciones de "Tablas Maestras".
- [ ] Menú muestra opción "Copiloto IA".

### D. Copiloto IA (Ollama)
- [ ] Acceso al chat de IA desde el menú.
- [ ] Envío de mensajes recibe respuesta del modelo local (Ollama).
- [ ] Restricciones de usuario normal no aplican al Superusuario.

## 4. Criterios de Aceptación

1. **Integridad de Datos**: Las llaves foráneas se guardan correctamente (IDs, no textos).
2. **UX/UI**: Los dropdowns muestran "Cargando..." mientras fetchean datos.
3. **Seguridad**: Solo roles ADMIN/SUPERADMIN ven ciertas opciones.
4. **Rendimiento**: Las listas cargan en menos de 2 segundos con datos normales.

## 5. Solución de Problemas Comunes

- **Error 401/403 en API**: Verificar token de autenticación en headers.
- **Dropdowns vacíos**: Revisar CORS en backend y conexión a BD.
- **Error de migración**: Asegurar que el script SQL se ejecutó sin errores.

---
*Fecha de última actualización: 2024*
