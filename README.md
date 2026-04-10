# Geo Constanza 🛡️
**Plataforma de Gestión de Guardias de Seguridad (GGSS) y Business Intelligence**

## 📝 Descripción del Proyecto
Geo Constanza es un sistema integral diseñado para optimizar la gestión, monitoreo y seguridad del personal de guardia (GGSS). La plataforma permite la administración de turnos y la validación de posiciones mediante geocercas, facilitando la toma de decisiones estratégicas a través de su módulo de Business Intelligence.

## 🏗️ Arquitectura y Estructura
El repositorio funciona en una estructura modular, dividiendo la lógica de cliente y servidor:

* **Frontend (Raíz del proyecto):** Dashboard administrativo y de visualización desarrollado con React y empaquetado con Vite para alta velocidad de despliegue.
* **Backend (`/geo-constanza-api`):** API RESTful en Node.js encargada de procesar la lógica de negocio, autenticación y comunicación con la base de datos.

## 🚀 Stack Tecnológico Principal
* **Frontend:** React.js, Vite.
* **Backend:** Node.js, Express.
* **Base de Datos:** PostgreSQL con extensión espacial **PostGIS** (vital para el cálculo y validación de coordenadas y geocercas).
* **Despliegue:** Vercel.

## ⚙️ Instalación y Ejecución Local
1. Clonar el repositorio: `git clone https://github.com/vnoram/Geo-Constanza.git`
2. Instalar dependencias del cliente: `npm install`
3. Instalar dependencias de la API: `cd geo-constanza-api && npm install`
4. Configurar las variables de entorno `.env` con las credenciales de PostgreSQL.
5. Iniciar en modo desarrollo: `npm run dev`
