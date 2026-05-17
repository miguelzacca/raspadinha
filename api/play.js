export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Sistema de prêmios com tiers
  // Probabilidades: Ouro 2%, Prata 8%, Bronze 15%, Sem prêmio 75%
  const roll = Math.floor(Math.random() * 100) + 1; // 1–100

  if (roll <= 2) {
    return res.status(200).json({
      win: false,
      prize: null,
      tier: "gold"
    });
  }

  if (roll <= 10) {
    return res.status(200).json({
      win: false,
      prize: null,
      tier: "silver"
    });
  }

  if (roll <= 25) {
    return res.status(200).json({
      win: false,
      prize: null,
      tier: "bronze"
    });
  }

  return res.status(200).json({
    win: false,
    prize: null,
    tier: null
  });
}
