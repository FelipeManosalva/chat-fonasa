# Chat Fonasa - Clínica Alemana Osorno

Sistema de chat con IA (Ollama + LLaMA) para consultas de precios y copagos de prestaciones médicas Fonasa.

## Características

- 💬 Chat interactivo con IA
- 🔍 Búsqueda inteligente (RAG) en base de datos PostgreSQL
- 🔧 Panel de administración para gestionar prestaciones
- 🚀 100% gratis y open source (sin APIs de pago)

## Requisitos

- Node.js 16+
- PostgreSQL
- Ollama con modelo llama3.2:3b instalado

## Instalación

1. Clonar el repositorio
```bash
git clone 
cd chat-fonasa
```

2. Instalar dependencias
```bash
npm install
```

3. Configurar base de datos
- Ejecutar el script `database.sql` en PostgreSQL

4. Configurar variables de entorno
- Copiar `.env.example` a `.env`
- Completar con tus credenciales

5. Iniciar servidor
```bash
npm start
```

## Uso

- **Chat**: `http://localhost:3000`
- **Admin**: `http://localhost:3000/admin.html`

## Tecnologías

- Backend: Node.js + Express
- Base de datos: PostgreSQL
- IA: Ollama + LLaMA 3.2
- Frontend: HTML + CSS + JavaScript vanilla
