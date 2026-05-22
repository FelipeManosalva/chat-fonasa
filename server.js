const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Función para consultar Ollama
async function consultarOllama(prompt) {
  const response = await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2:3b',
      prompt: prompt,
      stream: false
    })
  });
  
  const data = await response.json();
  return data.response;
}

// Función RAG mejorada: Buscar información relevante en la BD
async function buscarContexto(pregunta) {
  try {
    const palabrasClave = pregunta.toLowerCase().replace(/[¿?¡!,.:;]/g, '').split(' ').filter(p => p.length > 1);
    
    if (palabrasClave.length === 0) {
      return [];
    }
    
    const conditions = palabrasClave.map((_, index) => {
      const paramIndex = index + 1;
      return `(nombre ILIKE $${paramIndex} OR descripcion ILIKE $${paramIndex} OR categoria ILIKE $${paramIndex})`;
    }).join(' OR ');
    
    const params = palabrasClave.map(p => `%${p}%`);
    
    const result = await pool.query(
      `SELECT nombre, codigo_fonasa, precio, copago, categoria, descripcion 
       FROM prestaciones 
       WHERE ${conditions}
       ORDER BY 
         CASE 
           WHEN nombre ILIKE $1 THEN 1
           WHEN descripcion ILIKE $1 THEN 2
           ELSE 3
         END
       LIMIT 5`,
      params
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error buscando contexto:', error);
    return [];
  }
}

// RUTA: Chat con IA
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  const pregunta = message;

  try {
    const contexto = await buscarContexto(pregunta);
    
    console.log(`Búsqueda: "${pregunta}" encontró ${contexto.length} resultados`);
    
    let prompt = '';
    
    if (contexto.length > 0) {
      // Encontró prestaciones médicas en la base de datos
      prompt = `Eres un asistente amigable y profesional de la Clínica Alemana Osorno. 

El paciente pregunta: "${pregunta}"

Tienes esta información disponible en la base de datos:
${contexto.map(p => `
- ${p.nombre}
  - Código Fonasa: ${p.codigo_fonasa}
  - Precio: $${Number(p.precio).toLocaleString('es-CL')}
  - Copago: ${p.copago}%
  - Categoría: ${p.categoria}
  - Descripción: ${p.descripcion || 'N/A'}
`).join('\n')}

IMPORTANTE: Responde usando esta información exacta. Menciona el precio, código Fonasa y copago de forma clara y amigable.`;
    } else {
      // No encontró prestaciones - respuesta conversacional libre
      prompt = `Eres un asistente amigable de la Clínica Alemana Osorno. Puedes conversar naturalmente sobre temas generales, dar consejos de salud, responder preguntas médicas generales, y ser un compañero conversacional agradable.

El usuario dice: "${pregunta}"

Responde de forma natural, amigable y útil:
- Si es un saludo, saluda de vuelta y ofrece ayuda
- Si es una pregunta de salud general, responde con información útil (pero aclara que no reemplaza una consulta médica)
- Si te preguntan por precios o prestaciones específicas que no están en tu base de datos, di que no tienes esa información disponible y sugiere consultar directamente con la clínica
- Si es conversación casual, participa de forma amigable
- Mantén un tono profesional pero cercano

Responde en español de forma natural y conversacional.`;
    }

    const respuesta = await consultarOllama(prompt);

    res.json({
      response: respuesta,
      contexto_usado: contexto.length
    });

  } catch (error) {
    console.error('Error en chat:', error);
    res.status(500).json({ error: 'Error al procesar la consulta' });
  }
});

// RUTA: Listar todas las prestaciones
app.get('/api/prestaciones', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM prestaciones ORDER BY nombre');
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo prestaciones:', error);
    res.status(500).json({ error: 'Error al obtener prestaciones' });
  }
});

// RUTA: Agregar prestación
app.post('/api/prestaciones', async (req, res) => {
  const { nombre, codigo_fonasa, precio, copago, categoria, descripcion } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO prestaciones (nombre, codigo_fonasa, precio, copago, categoria, descripcion) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, codigo_fonasa, precio, copago, categoria, descripcion]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error agregando prestación:', error);
    res.status(500).json({ error: 'Error al agregar prestación' });
  }
});

// RUTA: Actualizar prestación
app.put('/api/prestaciones/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, codigo_fonasa, precio, copago, categoria, descripcion } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE prestaciones 
       SET nombre=$1, codigo_fonasa=$2, precio=$3, copago=$4, categoria=$5, descripcion=$6 
       WHERE id=$7 RETURNING *`,
      [nombre, codigo_fonasa, precio, copago, categoria, descripcion, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando prestación:', error);
    res.status(500).json({ error: 'Error al actualizar prestación' });
  }
});

// RUTA: Eliminar prestación
app.delete('/api/prestaciones/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query('DELETE FROM prestaciones WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando prestación:', error);
    res.status(500).json({ error: 'Error al eliminar prestación' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`✓ Conectado a PostgreSQL: ${process.env.DB_HOST}`);
  console.log(`✓ Ollama URL: ${process.env.OLLAMA_URL}`);
});