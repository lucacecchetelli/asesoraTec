const express = require("express");
const router = express.Router();
const users = require("../data/users");

router.post("/login", (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({error: "ID is required"});
    }

    const user = users.find(u => u.id === id);

    if (!user) {
        return res.status(401).json({error : "Invalid ID"});
    }

    res.json({
        success: true,
        role: user.role
    });
});

module.exports = router;