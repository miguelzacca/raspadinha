import { createClient } from "@libsql/client";

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { cpf } = req.body;
    if (!cpf || cpf.length !== 11) {
        return res.status(400).json({ error: "CPF inválido." });
    }

    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    
    if (!url || !authToken) {
        // Fallback for local testing without DB se env vars não estiverem setadas
        console.warn("Turso env vars missing. Skipping DB check.");
        return res.status(200).json({ success: true });
    }

    try {
        const client = createClient({ url, authToken });
        
        await client.execute(`
            CREATE TABLE IF NOT EXISTS sorteio_cpf (
                cpf TEXT PRIMARY KEY,
                data_criacao TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `);

        // Verifica se já participou
        const check = await client.execute({
            sql: "SELECT cpf FROM sorteio_cpf WHERE cpf = ?",
            args: [cpf]
        });

        if (check.rows && check.rows.length > 0) {
            return res.status(403).json({ error: "Este CPF já resgatou a chance grátis." });
        }

        // Registra participação
        await client.execute({
            sql: "INSERT INTO sorteio_cpf (cpf) VALUES (?)",
            args: [cpf]
        });

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error("Erro banco de dados CPF:", err);
        return res.status(500).json({ error: "Serviço indisponível no momento." });
    }
}
