import express from "express";
import {pool} from "./db.js";

const app = express();
app.use(express.json());

// LOGIN para paciente ou nutricionista
app.post("/login", async (req, res)=> {
    const {email,senha}=req.body;
    try{
        const result=await pool.query(
            "SELECT * FROM usuarios WHERE email=$1 AND senha=$2",
            [email,senha]
        );

        if (result.rows.length===0)
            return res.status(401).json({message:"Credenciais inválidas"});

        res.json(result.rows[0]);
    }catch(err){
        console.error(err);
        res.status(500).json({message:"Erro no login"});
    }
});

// Parte que irá criar a dieta do paciente 
app.post("/dietas", async(req,res) =>{
    const{titulo,descricao,paciente_id,criado_por}=req.body;

    try{
        const result= await pool.query(
            `INSERT INTO dietas (titulo, descricao, paciente_id, criado_por) VALUES($1,$2,$3,$4) RETURNING*`,
            [titulo, descricao, paciente_id,criado_por]
        );

        res.status(201).json(result.rows[0]);
    }catch(err){
        console.error(err);
        res.status(500).json({message: "Erro ao criar dieta"});
    }
});

// PArte que pode listar as dietas de um paciente
app.get("/dietas/:paciente_id", async (req,res)=> {
    const paciente_id= req.params.paciente_id;

    try{
        const result= await pool.query(
            "SELECT * FROM dietas WHERE paciente_i=$1 ORDER BY criado_em DESC", [paciente_id]
        );

        res.json(result.rows);
    }catch(err){
        console.error(err);
        res.status(500).json({message: "Erro ao listar dietas"});
    }
});

// Parte que apaga as dietas
 app.delete("/dietas/:id", async (req,res) => {
   const id =req.params.id;

   try{
    await pool.query("DELETE FROM diestas WHERE id=$1", [id]);
    res.json({ message: "Dieta apagada com sucesso"});
   }catch(err){
    console.error(err);
    res.status(500).json({message: "Erro ao apagar dieta"});
   }
 });

 // Iniciar o servidor
 const PORT = process.env.PORT || 3000;
 app.listen(PORT, () => console.log('API rodando em http://localhost:${PORT}'));
