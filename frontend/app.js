// ============================================================
// CAMPUS EQUIPMENT DAPP
// Supabase Authentication + Ethereum Sepolia Smart Contract
// ============================================================

// -------------------- CONFIGURATION --------------------

const CONTRACT_ADDRESS =
    "0x45D1015002fd5d2f9A3E0a3D4CE25B0b64Af8967";

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

// Supabase client is initialized in index.html.
const supabaseClient = window.supabaseClient;

// -------------------- BLOCKCHAIN STATE --------------------

let provider;
let signer;
let contract;
let currentAccount = "";
let contractOwner = "";

// -------------------- AUTHENTICATION STATE --------------------

let currentSession = null;

// -------------------- DOM ELEMENTS --------------------

const connectButton = document.getElementById("connectWallet");
const refreshButton = document.getElementById("refreshButton");
const registerForm = document.getElementById("registerForm");
const categorySelect = document.getElementById("equipmentCategory");
const customCategoryInput = document.getElementById("customCategory");

// -------------------- MESSAGE HELPERS --------------------

function showMessage(message, type = "") {
    const box = document.getElementById("messageBox");

    if (!box) {
        console.log(message);
        return;
    }

    box.textContent = message;
    box.className = "message" + (type ? " " + type : "");
}

function shortenAddress(address) {
    if (!address || address === ethers.ZeroAddress) {
        return "None";
    }

    return address.slice(0, 6) + "..." + address.slice(-4);
}

function setConnectionStatus(message, connected = false) {
    const status = document.getElementById("connectionStatus");

    if (status) {
        status.textContent = message;
    }

    const dot = document.querySelector(".status-dot");

    if (dot) {
        dot.style.background = connected ? "#168354" : "#a2aab7";
    }
}

// ============================================================
// AUTHENTICATION SCREEN
// ============================================================


function createAuthenticationScreen() {
    if (document.getElementById("authScreen")) {
        return;
    }

    const styles = document.createElement("style");
    styles.id = "authStyles";

    styles.textContent = `
        #authScreen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 24px;
            box-sizing: border-box;
            background:
                radial-gradient(ellipse at top right, #30245b 0%, transparent 45%),
                linear-gradient(135deg, #171525 0%, #211b3b 55%, #151421 100%);
            font-family: Arial, sans-serif;
        }

        .auth-card {
            width: 100%;
            max-width: 460px;
            padding: 38px;
            box-sizing: border-box;
            background: rgba(34, 30, 57, 0.96);
            border: 1px solid rgba(167, 139, 250, 0.25);
            border-radius: 20px;
            box-shadow: 0 24px 70px rgba(0, 0, 0, 0.3);
            color: #f5f3ff;
        }

        .auth-brand-icon {
            width: 54px;
            height: 54px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 15px;
            background: linear-gradient(135deg, #a78bfa, #536dfe);
            color: white;
            font-size: 27px;
            font-weight: bold;
            margin-bottom: 24px;
            box-shadow: 0 8px 25px rgba(124, 92, 246, 0.25);
        }

        .auth-card h1 {
            margin: 0 0 10px;
            color: #ffffff;
            font-size: 30px;
            letter-spacing: -0.7px;
        }

        .auth-subtitle {
            color: #b9b4d2;
            line-height: 1.7;
            margin-bottom: 26px;
            font-size: 14px;
        }

        .auth-card label {
            display: block;
            margin: 17px 0 8px;
            color: #e4defb;
            font-size: 13px;
            font-weight: 600;
        }

        .auth-card input,
        .auth-card select {
            width: 100%;
            box-sizing: border-box;
            padding: 14px;
            border: 1px solid #49415f;
            border-radius: 10px;
            background: #191729;
            color: #ffffff;
            font-size: 14px;
        }

        .auth-card input::placeholder {
            color: #928ba9;
        }

        .auth-card input:focus,
        .auth-card select:focus {
            outline: 2px solid rgba(167, 139, 250, 0.3);
            border-color: #a78bfa;
        }

        .auth-primary,
        .auth-secondary {
            width: 100%;
            padding: 14px;
            margin-top: 20px;
            border-radius: 10px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: 0.2s ease;
        }

        .auth-primary {
            border: none;
            background: linear-gradient(135deg, #7957e8, #4d67f5);
            color: white;
            box-shadow: 0 8px 22px rgba(91, 80, 229, 0.2);
        }

        .auth-primary:hover {
            filter: brightness(1.12);
            transform: translateY(-1px);
        }

        .auth-secondary {
            margin-top: 12px;
            background: #29243f;
            border: 1px solid #4a4166;
            color: #eee9ff;
        }

        .auth-secondary:hover {
            background: #342c50;
        }

        .auth-primary:disabled,
        .auth-secondary:disabled {
            opacity: 0.6;
            cursor: wait;
        }

        .auth-switch {
            margin-top: 20px;
            text-align: center;
            color: #b9b4d2;
            font-size: 13px;
        }

        .auth-link {
            padding: 8px 0;
            border: none;
            background: transparent;
            color: #b8a4ff;
            font-weight: 600;
            cursor: pointer;
        }

        .auth-link:hover {
            color: #ffffff;
        }

        #authMessage {
            margin-top: 15px;
            padding: 12px;
            border-radius: 9px;
            font-size: 13px;
            line-height: 1.5;
            display: none;
            overflow-wrap: anywhere;
        }

        #authMessage.auth-error {
            display: block;
            background: #3b202d;
            color: #ffb4c4;
            border: 1px solid #6e3548;
        }

        #authMessage.auth-success {
            display: block;
            background: #17392f;
            color: #a7f3d0;
            border: 1px solid #28634f;
        }

        #authMessage.auth-info {
            display: block;
            background: #252c4c;
            color: #c7d2fe;
            border: 1px solid #424d7c;
        }

        .auth-note {
            margin-top: 22px;
            color: #a6a0c0;
            font-size: 12px;
            line-height: 1.7;
        }

        #logoutButton {
            margin-left: 10px;
            padding: 10px 14px;
            border: 1px solid #49415f;
            border-radius: 8px;
            background: #29243f;
            color: #eee9ff;
            cursor: pointer;
        }

        #accountStatus {
            margin: 12px 0;
            color: #c4bddf;
            font-size: 13px;
        }

        @media (max-width: 520px) {
            #authScreen {
                padding: 20px 14px;
            }

            .auth-card {
                padding: 26px 22px;
            }
        }
    `;

    document.head.appendChild(styles);

    const screen = document.createElement("section");
    screen.id = "authScreen";

    screen.innerHTML = `
        <div class="auth-card">
            <div class="auth-brand-icon">C</div>

            <h1 id="authHeading">Welcome back</h1>

            <p class="auth-subtitle">
                Sign in to the Campus Equipment Lending Portal.
                Your MetaMask wallet will be used separately
                for blockchain transactions.
            </p>

            <form id="authForm">
                <label for="authEmail">Email address</label>
                <input
                    type="email"
                    id="authEmail"
                    autocomplete="email"
                    placeholder="you@example.com"
                    required
                >

                <label for="authPassword">Password</label>
                <input
                    type="password"
                    id="authPassword"
                    autocomplete="current-password"
                    minlength="8"
                    placeholder="Enter your password"
                    required
                >

                <div id="confirmPasswordGroup" hidden>
                    <label for="authConfirmPassword">
                        Confirm password
                    </label>
                    <input
                        type="password"
                        id="authConfirmPassword"
                        autocomplete="new-password"
                        minlength="8"
                        placeholder="Re-enter your password"
                    >
                </div>

                <button
                    type="submit"
                    id="authSubmit"
                    class="auth-primary"
                >
                    Sign In
                </button>
            </form>

            <button
                type="button"
                id="authModeButton"
                class="auth-secondary"
            >
                Create a new account
            </button>

            <button
                type="button"
                id="forgotPasswordButton"
                class="auth-link"
                style="display:block; margin:16px auto 0;"
            >
                Forgot password?
            </button>

            <div
                id="authMessage"
                role="status"
                aria-live="polite"
            ></div>

            <p class="auth-note">
                Student and teacher accounts use the same secure sign-in.
                Administrator permissions are determined by the deployed
                smart contract owner, not by choosing a role during signup.
            </p>
        </div>
    `;

    document.body.insertBefore(screen, document.body.firstChild);

    const header = document.querySelector(".topbar");
    const main = document.querySelector("main.container");

    if (header) {
        header.style.display = "none";
    }

    if (main) {
        main.style.display = "none";
    }

    const logoutButton = document.createElement("button");
    logoutButton.id = "logoutButton";
    logoutButton.type = "button";
    logoutButton.textContent = "Sign Out";
    logoutButton.style.display = "none";

    if (connectButton && connectButton.parentElement) {
        connectButton.insertAdjacentElement("afterend", logoutButton);
    }

    document.getElementById("authModeButton")
        .addEventListener("click", toggleAuthMode);

    document.getElementById("authForm")
        .addEventListener("submit", handleAuthSubmit);

    document.getElementById("forgotPasswordButton")
        .addEventListener("click", handleForgotPassword);

    logoutButton.addEventListener("click", handleLogout);
}


let authMode = "login";

function setAuthMessage(message, type = "info") {
    const box = document.getElementById("authMessage");

    if (!box) return;

    box.textContent = message;
    box.className = "auth-" + type;
}

function clearAuthMessage() {
    const box = document.getElementById("authMessage");

    if (!box) return;

    box.textContent = "";
    box.className = "";
}

function toggleAuthMode() {
    authMode = authMode === "login" ? "signup" : "login";

    const heading = document.getElementById("authHeading");
    const submit = document.getElementById("authSubmit");
    const modeButton = document.getElementById("authModeButton");
    const confirmGroup = document.getElementById("confirmPasswordGroup");
    const password = document.getElementById("authPassword");
    const confirmPassword = document.getElementById("authConfirmPassword");
    const forgotButton = document.getElementById("forgotPasswordButton");

    clearAuthMessage();

    if (authMode === "signup") {
        heading.textContent = "Create your account";
        submit.textContent = "Create Account";
        modeButton.textContent = "Already have an account? Sign in";
        confirmGroup.hidden = false;
        confirmPassword.required = true;
        password.autocomplete = "new-password";
        forgotButton.style.display = "none";
    } else {
        heading.textContent = "Welcome back";
        submit.textContent = "Sign In";
        modeButton.textContent = "Create a new account";
        confirmGroup.hidden = true;
        confirmPassword.required = false;
        confirmPassword.value = "";
        password.autocomplete = "current-password";
        forgotButton.style.display = "block";
    }
}

async function handleAuthSubmit(event) {
    event.preventDefault();

    if (!supabaseClient) {
        setAuthMessage(
            "Supabase has not initialized. Check the Supabase script and client configuration in index.html.",
            "error"
        );
        return;
    }

    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const confirmPassword =
        document.getElementById("authConfirmPassword").value;

    const submit = document.getElementById("authSubmit");
    submit.disabled = true;

    try {
        clearAuthMessage();

        if (authMode === "signup") {
            if (password !== confirmPassword) {
                setAuthMessage("The passwords do not match.", "error");
                return;
            }

            if (password.length < 8) {
                setAuthMessage(
                    "Use a password with at least 8 characters.",
                    "error"
                );
                return;
            }

            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password
            });

            if (error) throw error;

            if (data.session) {
                currentSession = data.session;
                showAuthenticatedPortal();
            } else {
                setAuthMessage(
                    "Account created. Check your email for the confirmation link, then return here and sign in.",
                    "success"
                );
            }
        } else {
            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

            if (error) throw error;

            currentSession = data.session;
            showAuthenticatedPortal();
        }
    } catch (error) {
        setAuthMessage(
            error.message || "Authentication failed. Please try again.",
            "error"
        );
    } finally {
        submit.disabled = false;
    }
}

async function handleForgotPassword() {
    if (!supabaseClient) return;

    const email = document.getElementById("authEmail").value.trim();

    if (!email) {
        setAuthMessage(
            "Enter your email address first, then choose Forgot password.",
            "error"
        );
        return;
    }

    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(
            email,
            {
                redirectTo: window.location.origin + window.location.pathname
            }
        );

        if (error) throw error;

        setAuthMessage(
            "If an account exists for this email, a password reset link will be sent. Check your inbox.",
            "success"
        );
    } catch (error) {
        setAuthMessage(
            error.message || "Could not request a password reset.",
            "error"
        );
    }
}

async function handleLogout() {
    try {
        if (supabaseClient) {
            const { error } = await supabaseClient.auth.signOut();

            if (error) throw error;
        }

        currentSession = null;
        currentAccount = "";
        contractOwner = "";
        signer = null;
        provider = null;
        contract = null;

        if (connectButton) {
            connectButton.textContent = "Connect MetaMask";
        }

        setConnectionStatus("Wallet not connected", false);
        updateAdminFormVisibility();
        showAuthenticationPortal();
    } catch (error) {
        showMessage(error.message || "Could not sign out.", "error");
    }
}

function showAuthenticationPortal() {
    const screen = document.getElementById("authScreen");
    const header = document.querySelector(".topbar");
    const main = document.querySelector("main.container");
    const logoutButton = document.getElementById("logoutButton");

    if (screen) screen.style.display = "flex";
    if (header) header.style.display = "none";
    if (main) main.style.display = "none";
    if (logoutButton) logoutButton.style.display = "none";

    clearAuthMessage();
}

function showAuthenticatedPortal() {
    const screen = document.getElementById("authScreen");
    const header = document.querySelector(".topbar");
    const main = document.querySelector("main.container");
    const logoutButton = document.getElementById("logoutButton");

    if (screen) screen.style.display = "none";
    if (header) header.style.display = "flex";
    if (main) main.style.display = "block";
    if (logoutButton) logoutButton.style.display = "inline-block";

    const activity = document.getElementById("activityArea");

    if (activity && !currentAccount) {
        activity.textContent =
            "Connect MetaMask to view your borrowing activity.";
    }

    updateAdminFormVisibility();
}

// ============================================================
// ADMIN ACCESS
// ============================================================

function isAdmin() {
    return Boolean(
        currentSession &&
        currentAccount &&
        contractOwner &&
        currentAccount.toLowerCase() === contractOwner.toLowerCase()
    );
}

function updateAdminFormVisibility() {
    if (!registerForm) return;

    const admin = isAdmin();

    registerForm.style.display = admin ? "" : "none";

    const adminMessage = document.getElementById("adminOnlyMessage");

    if (adminMessage) {
        adminMessage.style.display = admin ? "none" : "block";

        adminMessage.textContent = admin
            ? ""
            : "Equipment registration is available to the administrator only.";
    }
}

// ============================================================
// CATEGORY FIELD
// ============================================================

function updateCustomCategoryField() {
    if (!categorySelect || !customCategoryInput) return;

    const isOther = categorySelect.value === "Other";

    customCategoryInput.style.display = isOther ? "block" : "none";
    customCategoryInput.required = isOther;

    if (!isOther) {
        customCategoryInput.value = "";
    }
}

// ============================================================
// METAMASK CONNECTION
// ============================================================

async function connectWallet() {
    if (!currentSession) {
        showMessage("Please sign in before connecting MetaMask.", "error");
        return;
    }

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
                "Ethers.js could not be loaded. Check your internet connection and reload.",
                "error"
            );
            return;
        }

        if (!ethers.isAddress(CONTRACT_ADDRESS)) {
            showMessage("Contract address is invalid.", "error");
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
            contract = null;
            signer = null;

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
                ? "Connected as the smart contract administrator."
                : "Wallet connected successfully. Student borrowing is enabled.",
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

// ============================================================
// LOAD EQUIPMENT INVENTORY
// ============================================================

// ============================================================
// LOAD EQUIPMENT — GROUP BY TYPE, KEEP INDIVIDUAL ITEM IDs
// ============================================================

async function loadEquipment() {
    const table = document.getElementById("equipmentTable");

    if (!table) return;

    if (!contract) {
        table.innerHTML = `
            <tr>
                <td colspan="6">
                    Connect MetaMask to load equipment.
                </td>
            </tr>
        `;
        return;
    }

    try {
        const count = Number(await contract.getEquipmentCount());

        const physicalItems = [];
        const groupedItems = new Map();

        let availableCount = 0;
        let borrowedCount = 0;

        // Read each individual item from the blockchain.
        for (let id = 1; id <= count; id++) {
            const item = await contract.getEquipment(id);

            const physicalItem = {
                id: Number(item[0]),
                name: item[1],
                category: item[2],
                available: item[3],
                borrower: item[4]
            };

            physicalItems.push(physicalItem);

            if (physicalItem.available) {
                availableCount++;
            } else {
                borrowedCount++;
            }

            // Group matching equipment names and categories.
            const groupKey =
                physicalItem.name.trim().toLowerCase() +
                "::" +
                physicalItem.category.trim().toLowerCase();

            if (!groupedItems.has(groupKey)) {
                groupedItems.set(groupKey, {
                    name: physicalItem.name,
                    category: physicalItem.category,
                    items: []
                });
            }

            groupedItems.get(groupKey).items.push(physicalItem);
        }

        table.innerHTML = "";

        if (physicalItems.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="6">
                        No equipment registered yet.
                    </td>
                </tr>
            `;
        }

        // Display a summary for each equipment type,
        // followed by the individual physical items.
        for (const group of groupedItems.values()) {
            const groupAvailable = group.items.filter(
                item => item.available
            ).length;

            const groupBorrowed =
                group.items.length - groupAvailable;

            // Equipment type summary row.
            const summaryRow = document.createElement("tr");

            summaryRow.className = "equipment-group-row";

            summaryRow.innerHTML = `
                <td colspan="6">
                    <strong>${escapeEquipmentText(group.name)}</strong>
                    <span> · ${escapeEquipmentText(group.category)}</span>
                    <div class="equipment-group-summary">
                        Total pieces: ${group.items.length}
                        &nbsp; | &nbsp;
                        Available: ${groupAvailable}
                        &nbsp; | &nbsp;
                        Borrowed: ${groupBorrowed}
                    </div>
                </td>
            `;

            table.appendChild(summaryRow);

            // Individual item rows keep their own blockchain IDs.
            for (const item of group.items) {
                const row = document.createElement("tr");

                const itemId =
                    "EQ" + String(item.id).padStart(3, "0");

                const status = item.available
                    ? "Available"
                    : "Borrowed";

                const borrower = item.available
                    ? "—"
                    : shortenAddress(item.borrower);

                let actionButton = "";

                if (item.available) {
                    actionButton = `
                        <button
                            type="button"
                            class="borrow-button"
                            data-action="borrow"
                            data-id="${item.id}"
                        >
                            Borrow
                        </button>
                    `;
                } else if (
                    currentAccount &&
                    item.borrower.toLowerCase() ===
                    currentAccount.toLowerCase()
                ) {
                    actionButton = `
                        <button
                            type="button"
                            class="return-button"
                            data-action="return"
                            data-id="${item.id}"
                        >
                            Return
                        </button>
                    `;
                } else {
                    actionButton = `
                        <button type="button" disabled>
                            In Use
                        </button>
                    `;
                }

                row.innerHTML = `
                    <td>${itemId}</td>
                    <td>${escapeEquipmentText(item.name)}</td>
                    <td>${escapeEquipmentText(item.category)}</td>
                    <td>${status}</td>
                    <td>${borrower}</td>
                    <td>${actionButton}</td>
                `;

                table.appendChild(row);
            }
        }

        // Connect each button to the exact physical item ID.
        table.querySelectorAll("[data-action='borrow']")
            .forEach(button => {
                button.addEventListener("click", async () => {
                    const id = Number(button.dataset.id);
                    await borrowItem(id);
                });
            });

        table.querySelectorAll("[data-action='return']")
            .forEach(button => {
                button.addEventListener("click", async () => {
                    const id = Number(button.dataset.id);
                    await returnItem(id);
                });
            });

        // Dashboard counts represent physical pieces,
        // not the number of equipment types.
        const totalElement =
            document.getElementById("totalEquipment");

        const availableElement =
            document.getElementById("availableEquipment");

        const borrowedElement =
            document.getElementById("borrowedEquipment");

        if (totalElement) {
            totalElement.textContent = count;
        }

        if (availableElement) {
            availableElement.textContent = availableCount;
        }

        if (borrowedElement) {
            borrowedElement.textContent = borrowedCount;
        }
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

// Escape text before inserting equipment names into HTML.
function escapeEquipmentText(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ============================================================
// REGISTER EQUIPMENT — CONTRACT OWNER ONLY
// ============================================================

async function registerEquipment(event) {
    event.preventDefault();

    if (!currentSession) {
        showMessage("Sign in first.", "error");
        return;
    }

    if (!contract || !currentAccount) {
        showMessage("Connect the administrator's MetaMask wallet first.", "error");
        return;
    }

    if (!isAdmin()) {
        showMessage(
            "Only the wallet that owns the deployed contract can register equipment.",
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

        const transactionHashElement =
            document.getElementById("transactionHash");

        if (transactionHashElement) {
            transactionHashElement.textContent = "Transaction: " + tx.hash;
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

// ============================================================
// BORROW EQUIPMENT
// ============================================================

async function borrowItem(equipmentId) {
    if (!currentSession) {
        showMessage("Sign in first.", "error");
        return;
    }

    if (!contract || !currentAccount) {
        showMessage("Connect your wallet first.", "error");
        return;
    }

    try {
        showMessage("Waiting for borrowing transaction confirmation...");

        const tx = await contract.borrowEquipment(equipmentId);

        const transactionHashElement =
            document.getElementById("transactionHash");

        if (transactionHashElement) {
            transactionHashElement.textContent = "Transaction: " + tx.hash;
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

// ============================================================
// RETURN EQUIPMENT
// ============================================================

async function returnItem(equipmentId) {
    if (!currentSession) {
        showMessage("Sign in first.", "error");
        return;
    }

    if (!contract || !currentAccount) {
        showMessage("Connect your wallet first.", "error");
        return;
    }

    try {
        showMessage("Waiting for return transaction confirmation...");

        const tx = await contract.returnEquipment(equipmentId);

        const transactionHashElement =
            document.getElementById("transactionHash");

        if (transactionHashElement) {
            transactionHashElement.textContent = "Transaction: " + tx.hash;
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

// ============================================================
// BORROWING HISTORY
// ============================================================

async function loadMyActivity() {
    const area = document.getElementById("activityArea");

    if (!area) return;

    if (!contract || !currentAccount) {
        area.textContent =
            "Connect MetaMask to view your borrowing activity.";
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

// ============================================================
// EVENT LISTENERS
// ============================================================

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

// ============================================================
// INITIALIZATION
// ============================================================

async function initializeApp() {
    createAuthenticationScreen();
    updateAdminFormVisibility();

    if (!supabaseClient) {
        showAuthenticationPortal();

        setAuthMessage(
            "Supabase client is missing. Check the configuration in index.html.",
            "error"
        );

        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.getSession();

        if (error) throw error;

        currentSession = data.session;

        if (currentSession) {
            showAuthenticatedPortal();
        } else {
            showAuthenticationPortal();
        }

        supabaseClient.auth.onAuthStateChange((event, session) => {
            currentSession = session;

            if (session) {
                showAuthenticatedPortal();
            } else {
                currentAccount = "";
                contractOwner = "";
                signer = null;
                provider = null;
                contract = null;

                showAuthenticationPortal();
                updateAdminFormVisibility();
            }
        });
    } catch (error) {
        showAuthenticationPortal();

        setAuthMessage(
            error.message || "Unable to initialize authentication.",
            "error"
        );
    }
}

// Reload on wallet/network changes to refresh blockchain state.
if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => {
        window.location.reload();
    });

    window.ethereum.on("chainChanged", () => {
        window.location.reload();
    });
}

initializeApp();