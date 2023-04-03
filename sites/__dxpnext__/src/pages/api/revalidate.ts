export default async function handler(req, res) {
  // Implement token here.

  try {
    const pagesToRevalidate = [
      '/', // Edit this page.
      '/bar/', // Edit this page.
    ];

    const revalidationPromises = [];
    pagesToRevalidate.forEach(async (page) => {
      revalidationPromises.push(res.revalidate(page));
    });
    await Promise.all(revalidationPromises);

    return res.json({ revalidated: true });
  } catch (err) {
    // If there was an error, Next.js will continue
    // to show the last successfully generated page
    return res.status(500).send(err);
  }
}
