describe("Buttons Component", () => {
    beforeEach(async () => {
        await Promise.all([
            page.goto(
                `http://localhost:${process.env.PORT}/e2e-tests/browser-global/index.html`,
                {
                    waitUntil: "networkidle2",
                }
            ),
            page.waitForResponse((response) =>
                response.url().startsWith("https://www.paypal.com/sdk/js")
            ),
        ]);
    });

    it("should return the expected page <title>", async () => {
        const pageTitle = await page.title();
        expect(pageTitle).toBe("Demo with window.paypalLoadScript | PayPal JS");
    });

    it("should display the buttons", async () => {
        await expect(page).toMatchElement("iframe.component-frame.visible");
    });
});
