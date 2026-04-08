/// <reference types="vite/client" />
/// <reference types="chrome" />

const SUCCESS_MARKERS = [
	"thank you for donating to planet water foundation",
	"your payment is being processed",
	"receipt will be sent",
	"thank you for your donation",
	"donation successful",
];

let hasReportedSuccess = false;

function getPageText(): string {
	return document.body?.innerText?.toLowerCase() ?? "";
}

function looksLikeDonationSuccess(): boolean {
	const text = getPageText();
	return SUCCESS_MARKERS.some((marker) => text.includes(marker));
}

async function reportDonationCompleted() {
	if (hasReportedSuccess) return;
	hasReportedSuccess = true;

	try {
		await chrome.runtime.sendMessage({
			type: "DONATION_COMPLETED",
			url: window.location.href,
			timestamp: new Date().toISOString(),
		});
		console.log("[🍾💧 Bottle It Back] donation completion detected");
	} catch (error) {
		console.error(
			"[🍾💧 Bottle It Back] failed to report donation completion",
			error,
		);
	}
}

function checkForSuccess() {
	if (looksLikeDonationSuccess()) {
		void reportDonationCompleted();
	}
}

checkForSuccess();

const observer = new MutationObserver(() => {
	checkForSuccess();
});

observer.observe(document.documentElement, {
	childList: true,
	subtree: true,
	characterData: true,
});

window.addEventListener("load", checkForSuccess);
document.addEventListener("readystatechange", checkForSuccess);