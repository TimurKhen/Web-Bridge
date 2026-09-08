import {Contract, messagePort} from "../lib";

const iframe = document.createElement("iframe");
iframe.src = "/index.html";
iframe.style.display = "none";
document.body.appendChild(iframe);

iframe.onload = () => {
    const transport = messagePort(iframe);
    const contract = new Contract(transport);

    const unsubscribeUI = contract.on((data: any) => {
        console.log("[Iframe Response]:", data.result);
        const resultDiv = document.getElementById("result");
        if (resultDiv) resultDiv.innerText = `Result: ${data.result}`;
    });

    const sendBtn = document.getElementById("send");
    sendBtn?.addEventListener("click", () => {
        const input = document.getElementById("text") as HTMLInputElement;
        const value = Number(input?.value || 0);

        contract.emit({
            action: "sum",
            a: value,
            b: 10,
        });
    });
};
