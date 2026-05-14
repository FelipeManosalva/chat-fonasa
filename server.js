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
    // Extraer palabras clave de la pregunta (más de 3 letras)
    const palabrasClave = pregunta.toLowerCase()
      .replace(/[¿?¡!,.:;]/g, '') // quitar puntuación
      .split(' ')
      .filter(p => p.length > 3); // solo palabras significativas
    
    if (palabrasClave.length === 0) {
      return [];
    }
    
    // Construir la consulta con OR para cada palabra clave
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
    // 1. Buscar información relevante en la BD
    const contexto = await buscarContexto(pregunta);
    
    console.log(`📊 Búsqueda: "${pregunta}" → ${contexto.length} resultados encontrados`);
    
    // 2. Construir el prompt con el contexto
    let prompt = `Eres un asistente de la Clínica Alemana Osorno especializado en precios de prestaciones médicas Fonasa.

INFORMACIÓN DISPONIBLE:
${contexto.length > 0 
  ? contexto.map(p => `
- ${p.nombre} (${p.categoria})
  Código Fonasa: ${p.codigo_fonasa}
  Precio: $${p.precio}
  Copago: ${p.copago}%
  ${p.descripcion ? 'Descripción: ' + p.descripcion : ''}
`).join('\n')
  : 'No se encontró información específica en la base de datos.'}

PREGUNTA DEL USUARIO: ${pregunta}

INSTRUCCIONES:
- Responde SOLO con la información proporcionada arriba
- Si no hay información disponible, di "No tengo información sobre eso en este momento"
- Sé claro, preciso y amable
- Formatea los precios correctamente (ej: $15.000)
- Menciona el código Fonasa cuando sea relevante

RESPUESTA:`;

    // 3. Consultar a Ollama
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

// RUTA: Listar todas las prestaciones (para admin)
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