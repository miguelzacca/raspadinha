export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Sistema de prêmios com tiers
  // Probabilidades: Ouro 20%, Prata 30%, Bronze 50%
  const roll = Math.floor(Math.random() * 100) + 1; // 1–100

  // 20% Ouro (1 a 20)
  if (roll <= 20) {
    return res.status(200).json({
      win: false,
      prize: null,
      tier: "gold"
    });
  }

  // 30% Prata (21 a 50)
  if (roll <= 50) {
    return res.status(200).json({
      win: false,
      prize: null,
      tier: "silver"
    });
  }

  // Restante Bronze (51 a 100)
  return res.status(200).json({
    win: false,
    prize: null,
    tier: "bronze"
  });
}
