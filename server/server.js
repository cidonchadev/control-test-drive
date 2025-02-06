const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

app.use(cors());
app.use(express.json());

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root123',  // Asegúrate que esta es la contraseña que usaste al instalar MySQL
    database: 'testdrive_db',
    port: 3306
});

// Añade más logs para debug
connection.connect((err) => {
    if (err) {
        console.error('Error conectando a la base de datos:', err);
        return;
    }
    console.log('Conectado exitosamente a la base de datos');
});

io.on('connection', (socket) => {
    console.log('Cliente conectado');
    
    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
});

app.get('/api/citas', (req, res) => {
    connection.query('SELECT * FROM amg_citas_testdrive ORDER BY hora', (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json(results);
    });
});

// Endpoint para marcar/desmarcar llegada
app.put('/api/citas/:dni/registro', (req, res) => {
    const dni = req.params.dni;
    const { registrado } = req.body;
    
    console.log('Recibida petición de actualización:', { dni, registrado });

    connection.query(
        'UPDATE amg_citas_testdrive SET registrado = ? WHERE dni_nie = ?',
        [registrado, dni],
        (error, results) => {
            if (error) {
                console.error('Error en la actualización:', error);
                return res.status(500).json({ error: error.message });
            }

            console.log('Actualización exitosa:', results);
            io.emit('estadoActualizado', { dni_nie: dni, registrado });
            res.json({ success: true });
        }
    );
});

// Endpoint para crear una nueva cita
app.post('/api/citas', (req, res) => {
    const nuevaCita = {
        dni_nie: req.body.dni_nie,
        nombre: req.body.nombre,
        apellido: req.body.apellido,
        hora: req.body.hora,
        modelo: req.body.modelo,
        tipo_carroceria: req.body.tipo_carroceria,
        email: req.body.email || null,
        telefono: req.body.telefono || null,
        registrado: req.body.registrado || false,
        esNuevo: 1  // Marcamos como nuevo registro
    };

    connection.query(
        'INSERT INTO amg_citas_testdrive SET ?',
        nuevaCita,
        (error, results) => {
            if (error) {
                console.error('Error al crear cita:', error);
                return res.status(500).json({ error: error.message });
            }
            
            const citaCreada = { ...nuevaCita, id: results.insertId };
            io.emit('nuevaCita', citaCreada);
            res.json({ success: true, id: results.insertId });
        }
    );
});

// Endpoint para eliminar una cita
app.delete('/api/citas/:dni', (req, res) => {
    const dni = req.params.dni;
    
    connection.query(
        'DELETE FROM amg_citas_testdrive WHERE dni_nie = ?',
        [dni],
        (error, results) => {
            if (error) {
                console.error('Error al eliminar cita:', error);
                return res.status(500).json({ error: error.message });
            }
            
            if (results.affectedRows === 0) {
                return res.status(404).json({ error: 'No se encontró la cita' });
            }
            
            io.emit('participanteEliminado', { dni_nie: dni });
            res.json({ success: true });
        }
    );
});

const PORT = 5001;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});