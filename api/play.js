export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Sistema de prêmios com tiers
  const roll = Math.random() * 100;

  // 2% — Prêmio grande
  if (roll <= 2) {
    return res.status(200).json({
      win: true,
      prize: "R$ 100,00",
      tier: "gold"
    });
  }

  // 5% — Prêmio médio
  if (roll <= 7) {
    return res.status(200).json({
      win: true,
      prize: "R$ 50,00",
      tier: "silver"
    });
  }

  // 8% — Prêmio pequeno
  if (roll <= 15) {
    return res.status(200).json({
      win: true,
      prize: "R$ 20,00",
      tier: "bronze"
    });
  }

  // 85% — Sem prêmio
  return res.status(200).json({
    win: false,
    prize: null,
    tier: null
  });
}
