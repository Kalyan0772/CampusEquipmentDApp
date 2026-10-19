
const CONTRACT_ADDRESS = "0x45D1015002fd5d2f9A3E0a3D4CE25B0b64Af8967";

const CONTRACT_ABI = [
    "function owner() view returns (address)",
    "function getEquipmentCount() view returns (uint256)",
    "function getEquipment(uint256) view returns (uint256,string,string,bool,address)",
    "function registerEquipment(string,string)",
    "function borrowEquipment(uint256)",
    "function returnEquipment(uint256)",
    "function getBorrowHistory(uint256) view returns (tuple(uint256 equipmentId,address borrower,uint256 borrowedAt,uint256 returnedAt,bool returned)[])",
    "event EquipmentRegistered(uint256 indexed equipmentId,string name,string category)",
    "event EquipmentBorrowed(uint256 indexed equipmentId,address indexed borrower,uint256 timestamp)",
    "event EquipmentReturned(uint256 indexed equipmentId,address indexed borrower,uint256 timestamp)"
];

let provider;
let signer;
let contract;
let currentAccount = "";
let contractOwner = "";

const connectButton = document.getElementById("connectWallet");
const refreshButton = document.getElementById("refreshButton");
const registerForm = document.getElementById("registerForm");
const categorySelect = document.getElementById("equipmentCategory");
const customCategoryInput = document.getElementById("customCategory");

function showMessage(message, type = "") {
    const box = document.getElementById("messageBox");
    if (!box) return;

    box.textContent = message;
    box.className = "message" + (type ? " " + type : "");
}

function shortenAddress(address) {
    if (!address || address === ethers.ZeroAddress) return "None";
    return address.slice(0, 6) + "..." + address.slice(-4);
}

function setConnectionStatus(message, connected = false) {
    const status = document.getElementById("connectionStatus");
    if (status) status.textContent = message;

    const dot = document.querySelector(".status-dot");
    if (dot) {
        dot.style.background = connected ? "#168354" : "#a2aab7";
    }
}

function isAdmin() {
    return Boolean(
        currentAccount &&
        contractOwner &&
        currentAccount.toLowerCase() === contractOwner.toLowerCase()
    );
}

function updateAdminFormVisibility() {
    if (!registerForm) return;

    const admin = isAdmin();

    // Hide the entire registration form from non-admin wallets.
    registerForm.style.display = admin ? "" : "none";

    const adminMessage = document.getElementById("adminOnlyMessage");

    if (adminMessage) {
        adminMessage.style.display = admin ? "none" : "block";
        adminMessage.textContent = admin
            ? ""
            : "Equipment registration is available to the administrator only.";
    }
}

function updateCustomCategoryField() {
    if (!categorySelect || !customCategoryInput) return;

    const isOther = categorySelect.value === "Other";

    customCategoryInput.style.display = isOther ? "block" : "none";
    customCategoryInput.required = isOther;

    if (!isOther) {
        customCategoryInput.value = "";
    }
}

async function connectWallet() {
    try {
        if (!window.ethereum) {
            showMessage(
                "MetaMask is not installed. Install it and reload the page.",
                "error"
            );
            return;
        }

        if (!window.ethers) {
            showMessage(
                "Ethers.js could not be loaded. Check your internet connection and reload the page.",
                "error"
            );
            return;
        }

        if (!ethers.isAddress(CONTRACT_ADDRESS)) {
            showMessage(
                "Contract address is invalid. Check app.js.",
                "error"
            );
            return;
        }

        await window.ethereum.request({
            method: "eth_requestAccounts"
        });

        provider = new ethers.BrowserProvider(window.ethereum);

        const network = await provider.getNetwork();

        if (Number(network.chainId) !== 11155111) {
            currentAccount = "";
            contractOwner = "";
            updateAdminFormVisibility();

            showMessage(
                "Please switch MetaMask to the Sepolia test network, then reconnect.",
                "error"
            );
            return;
        }

        signer = await provider.getSigner();
        currentAccount = await signer.getAddress();

        contract = new ethers.Contract(
            CONTRACT_ADDRESS,
            CONTRACT_ABI,
            signer
        );

        contractOwner = await contract.owner();

        if (connectButton) {
            connectButton.textContent = shortenAddress(currentAccount);
        }

        setConnectionStatus("Wallet connected", true);
        updateAdminFormVisibility();

        await loadEquipment();
        await loadMyActivity();

        showMessage(
            isAdmin()
                ? "Connected as administrator."
                : "Wallet connected successfully.",
            "success"
        );

    } catch (error) {
        showMessage(
            error.shortMessage ||
            error.reason ||
            error.message ||
            "Wallet connection failed.",
            "error"
        );
    }
}

async function loadEquipment() {
    if (!contract) {
        showMessage("Connect your wallet first.", "error");
        return;
    }

    try {
        const count = Number(await contract.getEquipmentCount());
        const tbody = document.getElementById("equipmentTable");

        if (!tbody) return;

        tbody.innerHTML = "";

        let availableCount = 0;
        let borrowedCount = 0;

        for (let id = 1; id <= count; id++) {
            const item = await contract.getEquipment(id);

            const equipmentId = Number(item[0]);
            const name = item[1];
            const category = item[2];
            const available = item[3];
            const borrower = item[4];

            if (available) {
                availableCount++;
            } else {
                borrowedCount++;
            }

            const row = document.createElement("tr");

            const values = [
                "EQ" + String(equipmentId).padStart(3, "0"),
                name,
                category
            ];

            values.forEach(value => {
                const td = document.createElement("td");
                td.textContent = value;
                row.appendChild(td);
            });

            const statusCell = document.createElement("td");
            const badge = document.createElement("span");

            badge.className =
                "status " + (available ? "available" : "borrowed");

            badge.textContent = available ? "Available" : "Borrowed";

            statusCell.appendChild(badge);
            row.appendChild(statusCell);

            const borrowerCell = document.createElement("td");
            borrowerCell.textContent = shortenAddress(borrower);
            row.appendChild(borrowerCell);

            const actionCell = document.createElement("td");
            const actionButton = document.createElement("button");

            actionButton.className = "action-btn";

            if (available) {
                actionButton.textContent = "Borrow";
                actionButton.disabled = false;

                actionButton.addEventListener("click", () => {
                    borrowItem(equipmentId);
                });

            } else if (
                borrower.toLowerCase() === currentAccount.toLowerCase()
            ) {
                actionButton.textContent = "Return";
                actionButton.classList.add("return-btn");

                actionButton.addEventListener("click", () => {
                    returnItem(equipmentId);
                });

            } else {
                actionButton.textContent = "In Use";
                actionButton.disabled = true;
            }

            actionCell.appendChild(actionButton);
            row.appendChild(actionCell);
            tbody.appendChild(row);
        }

        if (count === 0) {
            tbody.innerHTML =
                '<tr><td colspan="6" class="empty">No equipment registered yet.</td></tr>';
        }

        const total = document.getElementById("totalEquipment");
        const availableElement = document.getElementById("availableEquipment");
        const borrowedElement = document.getElementById("borrowedEquipment");

        if (total) total.textContent = count;
        if (availableElement) availableElement.textContent = availableCount;
        if (borrowedElement) borrowedElement.textContent = borrowedCount;

    } catch (error) {
        showMessage(
            error.shortMessage ||
            error.reason ||
            error.message ||
            "Unable to load equipment.",
            "error"
        );
    }
}

async function registerEquipment(event) {
    event.preventDefault();

    if (!contract) {
        showMessage("Connect your wallet first.", "error");
        return;
    }

    if (!isAdmin()) {
        showMessage(
            "Only the contract administrator can register equipment.",
            "error"
        );
        return;
    }

    const nameInput = document.getElementById("equipmentName");
    const name = nameInput ? nameInput.value.trim() : "";

    let category = categorySelect ? categorySelect.value : "";

    if (category === "Other") {
        category = customCategoryInput
            ? customCategoryInput.value.trim()
            : "";
    }

    if (!name || !category) {
        showMessage(
            "Enter an equipment name and select or enter a category.",
            "error"
        );
        return;
    }

    try {
        showMessage("Waiting for registration transaction confirmation...");

        const tx = await contract.registerEquipment(name, category);

        const transactionHash = document.getElementById("transactionHash");

        if (transactionHash) {
            transactionHash.textContent = "Transaction: " + tx.hash;
        }

        await tx.wait();

        registerForm.reset();
        updateCustomCategoryField();

        await loadEquipment();

        showMessage("Equipment registered successfully.", "success");

    } catch (error) {
        showMessage(
            error.shortMessage ||
            error.reason ||
            error.message ||
            "Registration failed.",
            "error"
        );
    }
}

async function borrowItem(equipmentId) {
    if (!contract || !currentAccount) {
        showMessage("Connect your wallet first.", "error");
        return;
    }

    try {
        showMessage("Waiting for borrowing transaction confirmation...");

        const tx = await contract.borrowEquipment(equipmentId);

        const transactionHash = document.getElementById("transactionHash");

        if (transactionHash) {
            transactionHash.textContent = "Transaction: " + tx.hash;
        }

        await tx.wait();

        await loadEquipment();
        await loadMyActivity();

        showMessage("Equipment borrowed successfully.", "success");

    } catch (error) {
        showMessage(
            error.shortMessage ||
            error.reason ||
            error.message ||
            "Borrowing failed.",
            "error"
        );
    }
}

async function returnItem(equipmentId) {
    if (!contract || !currentAccount) {
        showMessage("Connect your wallet first.", "error");
        return;
    }

    try {
        showMessage("Waiting for return transaction confirmation...");

        const tx = await contract.returnEquipment(equipmentId);

        const transactionHash = document.getElementById("transactionHash");

        if (transactionHash) {
            transactionHash.textContent = "Transaction: " + tx.hash;
        }

        await tx.wait();

        await loadEquipment();
        await loadMyActivity();

        showMessage("Equipment returned successfully.", "success");

    } catch (error) {
        showMessage(
            error.shortMessage ||
            error.reason ||
            error.message ||
            "Return failed.",
            "error"
        );
    }
}

async function loadMyActivity() {
    const area = document.getElementById("activityArea");

    if (!area) return;

    if (!contract || !currentAccount) {
        area.textContent = "Connect your wallet to view your activity.";
        return;
    }

    try {
        const count = Number(await contract.getEquipmentCount());
        const records = [];

        for (let id = 1; id <= count; id++) {
            const history = await contract.getBorrowHistory(id);

            for (const record of history) {
                if (
                    record.borrower.toLowerCase() ===
                    currentAccount.toLowerCase()
                ) {
                    records.push({
                        equipmentId: Number(record.equipmentId),
                        borrowedAt: Number(record.borrowedAt),
                        returnedAt: Number(record.returnedAt),
                        returned: record.returned
                    });
                }
            }
        }

        records.sort((a, b) => b.borrowedAt - a.borrowedAt);
        area.innerHTML = "";

        if (records.length === 0) {
            area.textContent =
                "No borrowing activity found for this wallet.";
            return;
        }

        for (const record of records) {
            const item = document.createElement("div");
            item.className = "activity-item";

            const title = document.createElement("strong");
            title.textContent =
                "Equipment EQ" +
                String(record.equipmentId).padStart(3, "0");

            const status = document.createElement("p");
            status.textContent = record.returned
                ? "Returned"
                : "Currently borrowed";

            const date = document.createElement("p");
            date.textContent =
                "Borrowed: " +
                new Date(record.borrowedAt * 1000).toLocaleString();

            item.appendChild(title);
            item.appendChild(status);
            item.appendChild(date);

            if (record.returnedAt > 0) {
                const returnDate = document.createElement("p");
                returnDate.textContent =
                    "Returned: " +
                    new Date(record.returnedAt * 1000).toLocaleString();

                item.appendChild(returnDate);
            }

            area.appendChild(item);
        }

    } catch (error) {
        area.textContent = "Unable to load borrowing history.";
    }
}

if (connectButton) {
    connectButton.addEventListener("click", connectWallet);
}

if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
        await loadEquipment();
        await loadMyActivity();
    });
}

if (registerForm) {
    registerForm.addEventListener("submit", registerEquipment);
}

if (categorySelect) {
    categorySelect.addEventListener("change", updateCustomCategoryField);
    updateCustomCategoryField();
}

updateAdminFormVisibility();

if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => {
        window.location.reload();
    });

    window.ethereum.on("chainChanged", () => {
        window.location.reload();
    });
}
