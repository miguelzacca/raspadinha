export default async function handler(req, res) {
    // CORS configuration
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { price, description } = req.body; // price is expected to be 3.00

        const tag = process.env.INFINITEPAY_TAG || 'miguel-zacca'; // Padrão baseado no wepinkparceiros
        const host = req.headers.host || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';

        // Gera um NSU único
        const orderNsu = 'RSPT-' + Date.now().toString() + Math.floor(Math.random() * 1000).toString();

        const items = [
            {
                quantity: 1,
                price: Math.round((price || 3.00) * 100), // R$ 3,00 em centavos = 300
                description: description || 'Raspadinha Sorteio Instantâneo'
            }
        ];

        const ipRes = await fetch('https://api.checkout.infinitepay.io/links', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                handle: tag,
                redirect_url: `${protocol}://${host}/?paid=1`,
                webhook_url: `${protocol}://${host}/api/webhook`, // webhook opcional se precisar salvar db
                order_nsu: orderNsu,
                items: items,
                customer: {
                    name: "Participante Sorteio", // Pode ser dinâmico depois
                    email: "participante@sorteio.com"
                }
            })
        });

        if (ipRes.ok) {
            const ipData = await ipRes.json();
            if (ipData.url) {
                return res.status(200).json({ url: ipData.url, order_nsu: orderNsu });
            }
        }

        const errMsg = await ipRes.text();
        console.error("Erro InfinitePay API:", errMsg);
        return res.status(400).json({ error: "Erro ao gerar link de pagamento na InfinitePay." });

    } catch (error) {
        console.error("Erro interno no checkout:", error);
        return res.status(500).json({ error: "Serviço indisponível. Tente novamente mais tarde." });
    }
}
