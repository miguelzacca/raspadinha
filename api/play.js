export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Sistema de prêmios com tiers
  const roll = Math.random() * 100;

  // if (roll <= 2) {
  //   return res.status(200).json({
  //     win: true,
  //     prize: "R$ 100,00",
  //     tier: "gold"
  //   });
  // }

  // if (roll <= 7) {
  //   return res.status(200).json({
  //     win: true,
  //     prize: "R$ 50,00",
  //     tier: "silver"
  //   });
  // }

  // if (roll <= 15) {
  //   return res.status(200).json({
  //     win: true,
  //     prize: "R$ 20,00",
  //     tier: "bronze"
  //   });
  // }

  return res.status(200).json({
    win: false,
    prize: null,
    tier: null
  });
}
