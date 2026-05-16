export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Lógica de sorteio totalmente no backend
  const chancesDeGanhar = 0.05; // 5% de chance de ganhar
  const sorteio = Math.random();

  const isWinner = sorteio <= chancesDeGanhar;

  if (isWinner) {
    return res.status(200).json({
      win: true,
      prize: "R$ 50,00"
    });
  } else {
    return res.status(200).json({
      win: false,
      prize: null
    });
  }
}
