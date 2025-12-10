import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "./db.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// ================================
//  🔧 CORS CONFIG
// ================================
const allowedOrigins = [
  "https://anavitoria32.github.io", // front-end em produção
  "http://localhost:3000"           // front-end local
];

app.use(cors({
  origin: function(origin, callback) {
    // permitir requests sem origin (ex: Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Não permitido pelo CORS"));
    }
  },
  credentials: true
}));

app.use(express.json());

// ================================
//  🔐 FUNÇÃO PARA GERAR TOKEN JWT
// ================================
function gerarToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
}

// ================================
//  🔐 ROTA CSRF TOKEN
// ================================
app.get("/auth/csrf-token", (req, res) => {
  // token dummy para o front-end funcionar
  res.json({ csrfToken: "dummy-token" });
});

// ================================
//  🔐 LOGIN
// ================================
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM usuarios WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    const user = result.rows[0];
    const senhaValida = await bcrypt.compare(senha, user.senha);

    if (!senhaValida) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    delete user.senha;
    const token = gerarToken(user);
    res.json({ ...user, token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro no login" });
  }
});

// ================================
//  🔐 REGISTRO
// ================================
app.post("/register", async (req, res) => {
  const { nome, email, senha, role } = req.body;

  if (!nome || !email || !senha || !role) {
    return res.status(400).json({ message: "Dados incompletos" });
  }

  try {
    const existing = await pool.query(
      "SELECT * FROM usuarios WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0];

      if (existingUser.senha) {
        return res.status(400).json({ message: "Email já cadastrado" });
      } else {
        const hash = await bcrypt.hash(senha, 10);
        const updated = await pool.query(
          "UPDATE usuarios SET nome=$1, senha=$2, role=$3 WHERE id=$4 RETURNING *",
          [nome, hash, role, existingUser.id]
        );
        const user = updated.rows[0];
        delete user.senha;
        const token = gerarToken(user);
        return res.status(200).json({ ...user, token });
      }
    }

    const hash = await bcrypt.hash(senha, 10);
    const result = await pool.query(
      `INSERT INTO usuarios (nome, email, senha, role)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nome, email, hash, role]
    );

    const user = result.rows[0];
    delete user.senha;
    const token = gerarToken(user);

    res.status(201).json({ ...user, token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao registrar usuário" });
  }
});

// ================================
//  🔐 PACIENTES CRUD
// ================================
app.post("/patients", async (req, res) => {
  const { nome, email } = req.body;

  try {
    const existing = await pool.query(
      "SELECT id FROM usuarios WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Email já cadastrado" });
    }

    const result = await pool.query(
      `INSERT INTO usuarios (nome, email, role)
       VALUES ($1, $2, 'PATIENT') RETURNING *`,
      [nome, email]
    );

    res.status(201).json({ patient: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao criar paciente" });
  }
});

app.get("/patients", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nome, email FROM usuarios WHERE role='PATIENT' ORDER BY nome"
    );
    res.json({ patients: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao buscar pacientes" });
  }
});

app.put("/patients/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, email } = req.body;

  try {
    await pool.query(
      "UPDATE usuarios SET nome=$1, email=$2 WHERE id=$3",
      [nome, email, id]
    );
    res.json({ message: "Paciente atualizado com sucesso" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao atualizar paciente" });
  }
});

app.delete("/patients/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("DELETE FROM usuarios WHERE id = $1", [id]);
    res.json({ message: "Paciente removido" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao remover paciente" });
  }
});

// ================================
//  🔐 DIETAS
// ================================
app.post("/dietas", async (req, res) => {
  const {
    paciente_id, peso, idade, doencas, observacoes,
    periodo_inicio, periodo_fim, descricao
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO dietas 
       (paciente_id, peso, idade, doencas, observacoes, periodo_inicio, periodo_fim, descricao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [paciente_id, peso, idade, doencas, observacoes, periodo_inicio, periodo_fim, descricao]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao criar dieta" });
  }
});

app.get("/dietas", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, u.nome AS paciente_nome
      FROM dietas d
      JOIN usuarios u ON d.paciente_id = u.id
      ORDER BY d.created_at DESC
    `);
    res.json({ dietas: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao listar dietas" });
  }
});

app.delete("/dietas/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("DELETE FROM dietas WHERE id = $1", [id]);
    res.json({ message: "Dieta removida com sucesso" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ================================
//  🔐 START SERVER
// ================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
