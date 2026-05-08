-- Crear la base de datos
CREATE DATABASE chat_fonasa;

-- Conectarse a la base de datos
\c chat_fonasa;

-- Crear tabla de prestaciones
CREATE TABLE prestaciones (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  codigo_fonasa VARCHAR(50),
  precio DECIMAL(10, 2) NOT NULL,
  copago DECIMAL(5, 2) NOT NULL,
  categoria VARCHAR(100),
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar datos de ejemplo
INSERT INTO prestaciones (nombre, codigo_fonasa, precio, copago, categoria, descripcion) VALUES
('Consulta Médica General', '0101001', 15000, 20, 'Consultas', 'Consulta médica ambulatoria con médico general'),
('Radiografía de Tórax', '0401001', 12000, 20, 'Imagenología', 'Radiografía simple de tórax, 2 proyecciones'),
('Hemograma Completo', '0301054', 5000, 20, 'Laboratorio', 'Recuento completo de células sanguíneas'),
('Ecografía Abdominal', '0403005', 25000, 20, 'Imagenología', 'Ecografía abdominal completa'),
('Electrocardiograma', '0404001', 8000, 20, 'Procedimientos', 'ECG de reposo con informe');

-- Crear índices para búsquedas más rápidas
CREATE INDEX idx_prestaciones_nombre ON prestaciones(nombre);
CREATE INDEX idx_prestaciones_categoria ON prestaciones(categoria);
CREATE INDEX idx_prestaciones_codigo ON prestaciones(codigo_fonasa);