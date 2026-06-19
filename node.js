// include server.js here

const db = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'b3t3lg3us3',
    database: 'teacher_data'
});

app.get('/api/classes/:nomina', (req, res) => {
    const teacherId = req.params.nomina;
    
    const sql = "SELECT materia FROM teacher_data WHERE nomina = ?";
    
    db.query(sql, [teacherId], (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

app.listen(3000, () => console.log('Server running on port 3000'));