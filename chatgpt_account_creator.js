/**
 * ChatGPT Account Creator Automation Script
 * This script automates the creation of ChatGPT accounts using temporary browser data.
 * Converted from Python Playwright to Node.js Playwright.
 */

import { firefox } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import * as cheerio from 'cheerio';
import { faker } from '@faker-js/faker';

class ChatGPTAccountCreator {
    constructor() {
        this.accountsFile = 'accounts.txt';
        this.createdAccounts = [];
        this.configFile = 'config.json';
        this.config = this.loadConfig();
        this.currentProgress = null;
    }

    log(message, level = null) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        // Use currentProgress if available, otherwise use level or default to INFO
        let label;
        if (this.currentProgress) {
            label = this.currentProgress;
        } else if (level) {
            label = level;
        } else {
            label = "INFO";
        }
        const logMessage = `[${timestamp}] [${label}] ${message}`;
        console.log(logMessage);
    }

    loadConfig() {
        const defaultConfig = {
            max_workers: 3,
            headless: false,
            slow_mo: 1000,
            timeout: 30000,
            password: null
        };

        try {
            if (fs.existsSync(this.configFile)) {
                const configData = fs.readFileSync(this.configFile, 'utf-8');
                const config = JSON.parse(configData);
                Object.assign(defaultConfig, config);

                if (defaultConfig.password) {
                    const password = defaultConfig.password;
                    if (password.length < 12) {
                        this.log(`⚠️ Warning: Password in config.json is less than 12 characters. ChatGPT requires at least 12 characters.`, "WARNING");
                    }
                }

                return defaultConfig;
            } else {
                fs.writeFileSync(this.configFile, JSON.stringify(defaultConfig, null, 2), 'utf-8');
                this.log(`📝 Created default config file: ${this.configFile}`);
                return defaultConfig;
            }
        } catch (e) {
            this.log(`⚠️ Error loading config: ${e.message}, using defaults`, "WARNING");
            return defaultConfig;
        }
    }


    randstr(length) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    generateRandomEmail() {
        return new Promise((resolve, reject) => {
            fetch('https://generator.email/', {
                method: 'get',
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
                    'accept-encoding': 'gzip, deflate, br'
                }
            })
                .then(res => res.text())
                .then(text => {
                    const $ = cheerio.load(text);
                    const domains = [];
                    $('.e7m.tt-suggestions').find('div > p').each(function (index, element) {
                        domains.push($(element).text());
                    });

                    if (domains.length > 0) {
                        const domain = domains[Math.floor(Math.random() * domains.length)];

                        // Generate and store names for later use
                        this.currentFirstName = faker.person.firstName().replace(/["']/g, '');
                        this.currentLastName = faker.person.lastName().replace(/["']/g, '');

                        const randomStr = this.randstr(5);
                        const email = `${this.currentFirstName}${this.currentLastName}${randomStr}@${domain}`.toLowerCase();

                        this.log(`📧 Generated email: ${email}`);
                        resolve(email);
                    } else {
                        reject(new Error('No domains found from generator.email'));
                    }
                })
                .catch(err => reject(err));
        });
    }


    generateRandomName() {
        // Use stored names from generateRandomEmail if available
        if (this.currentFirstName && this.currentLastName) {
            return `${this.currentFirstName} ${this.currentLastName}`;
        }

        // Fallback: generate new names using faker
        const firstName = faker.person.firstName().replace(/["']/g, '');
        const lastName = faker.person.lastName().replace(/["']/g, '');
        return `${firstName} ${lastName}`;
    }

    generateRandomBirthday() {
        const today = new Date();
        const minYear = today.getFullYear() - 65;
        const maxYear = today.getFullYear() - 18;

        const year = Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;
        const month = Math.floor(Math.random() * 12) + 1;

        let maxDay;
        if ([1, 3, 5, 7, 8, 10, 12].includes(month)) {
            maxDay = 31;
        } else if ([4, 6, 9, 11].includes(month)) {
            maxDay = 30;
        } else {
            // February - check leap year
            if (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) {
                maxDay = 29;
            } else {
                maxDay = 28;
            }
        }

        const day = Math.floor(Math.random() * maxDay) + 1;

        return { year, month, day };
    }

    saveAccount(email, password) {
        try {
            this.createdAccounts.push({ email, password });
            fs.appendFileSync(this.accountsFile, `${email}|${password}\n`, 'utf-8');
            this.log(`💾 Saved account to ${this.accountsFile}: ${email}`);
        } catch (e) {
            this.log(`❌ Error saving account: ${e.message}`, "ERROR");
        }
    }

    async getVerificationCode(email, maxRetries = 5, delay = 2) {
        // Extract username and domain from email
        const [username, domain] = email.split('@');

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch('https://generator.email/', {
                    method: 'GET',
                    headers: {
                        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                        'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                        'cookie': `surl=${domain}/${username}`,
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    redirect: 'follow'
                });

                const text = await response.text();
                const $ = cheerio.load(text);

                // Try to get verification code from email content
                const otpText = $("#email-table > div.e7m.list-group-item.list-group-item-info > div.e7m.subj_div_45g45gg").text().trim();

                if (otpText && otpText.length > 0) {
                    // Extract numeric code if present
                    const codeMatch = otpText.match(/\d{6}/);
                    if (codeMatch) {
                        const code = codeMatch[0];
                        this.log(`✅ Retrieved verification code: ${code}`);
                        return code;
                    } else if (/^\d+$/.test(otpText)) {
                        this.log(`✅ Retrieved verification code: ${otpText}`);
                        return otpText;
                    }
                }

                if (attempt < maxRetries - 1) {
                    this.log(`⏳ Code not found, waiting ${delay}s before retry ${attempt + 1}/${maxRetries}...`);
                    await this.sleep(delay * 1000);
                }

            } catch (e) {
                this.log(`⚠️ Error fetching verification code (attempt ${attempt + 1}): ${e.message}`, "WARNING");
                if (attempt < maxRetries - 1) {
                    await this.sleep(delay * 1000);
                }
            }
        }

        this.log(`❌ Failed to get verification code after ${maxRetries} attempts`, "ERROR");
        return null;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    }

    async createAccount(accountNumber, totalAccounts) {
        // Set progress for logging
        this.currentProgress = `${accountNumber}/${totalAccounts}`;

        const email = await this.generateRandomEmail();
        const password = this.config.password;

        if (!password) {
            this.log("❌ Error: No password found in config.json! Please add a 'password' field to config.json", "ERROR");
            return false;
        }

        if (password.length < 12) {
            this.log(`⚠️ Warning: Password in config.json is only ${password.length} characters. ChatGPT requires at least 12 characters.`, "WARNING");
        }

        const name = this.generateRandomName();
        const birthday = this.generateRandomBirthday();

        // this.log(`🚀 Creating account ${accountNumber}/${totalAccounts}: ${email}`);

        const uniqueId = uuidv4().substring(0, 8);
        const timestamp = Date.now();
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `chatgpt_browser_${accountNumber}_${timestamp}_${uniqueId}_`));

        try {
            const firefoxVersion = "131.0";
            const userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${firefoxVersion}) Gecko/20100101 Firefox/${firefoxVersion}`;

            const extraHttpHeaders = {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0',
            };

            const firefoxUserPrefs = {
                'dom.webdriver.enabled': false,
                'useAutomationExtension': false,
                'marionette.enabled': false,
            };

            const context = await firefox.launchPersistentContext(tempDir, {
                headless: this.config.headless !== false,
                viewport: { width: 1366, height: 768 },
                userAgent: userAgent,
                locale: 'en-US',
                timezoneId: 'America/New_York',
                deviceScaleFactor: 0.9,
                hasTouch: false,
                isMobile: false,
                ignoreHTTPSErrors: true,
                bypassCSP: true,
                extraHTTPHeaders: extraHttpHeaders,
                firefoxUserPrefs: firefoxUserPrefs,
                timeout: 30000,
            });

            const pages = context.pages();
            const page = pages.length > 0 ? pages[0] : await context.newPage();

            const firefoxStealthScript = `
                (function() {
                    // Hide webdriver property (Firefox)
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                        configurable: true
                    });
                    
                    // Override plugins to look realistic
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => {
                            return {
                                length: 0,
                                item: function() { return null; },
                                namedItem: function() { return null; },
                                refresh: function() {}
                            };
                        },
                        configurable: true
                    });
                    
                    // Override languages
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en'],
                        configurable: true
                    });
                    
                    // Override permissions query
                    const originalQuery = window.navigator.permissions.query;
                    if (originalQuery) {
                        window.navigator.permissions.query = (parameters) => (
                            parameters.name === 'notifications' ?
                                Promise.resolve({ state: Notification.permission }) :
                                originalQuery(parameters)
                        );
                    }
                    
                    // Remove automation indicators
                    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
                    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
                    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
                    
                    // Firefox-specific: Hide marionette
                    delete navigator.__marionette;
                    delete navigator.__fxdriver;
                    delete navigator._driver;
                    delete navigator._selenium;
                    delete navigator.__driver_evaluate;
                    delete navigator.__webdriver_evaluate;
                    delete navigator.__selenium_evaluate;
                    delete navigator.__fxdriver_evaluate;
                    delete navigator.__driver_unwrapped;
                    delete navigator.__webdriver_unwrapped;
                    delete navigator.__selenium_unwrapped;
                    delete navigator.__fxdriver_unwrapped;
                })();
            `;

            await page.addInitScript(firefoxStealthScript);

            // Step 1: Navigate to ChatGPT
            try {
                await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
                await this.sleep(2000);

                await page.evaluate(() => {
                    return {
                        webdriver: navigator.webdriver,
                        userAgent: navigator.userAgent,
                        languages: navigator.languages,
                        platform: navigator.platform,
                        plugins: navigator.plugins.length,
                        cookieEnabled: navigator.cookieEnabled,
                        onLine: navigator.onLine
                    };
                });

            } catch (e) {
                this.log(`❌ Error navigating to ChatGPT: ${e.message}`, "ERROR");
                return false;
            }
            // Click Sign up button using XPath
            this.log("🔘 Processing 'Sign up'");
            try {
                const signupButtonXPath = '/html/body/div[2]/div[1]/div/div/div[2]/div/header/div[3]/div[2]/div/div/div/button[2]/div';
                const signupButton = page.locator(`xpath=${signupButtonXPath}`);

                // Wait for the signup button to be visible with longer timeout
                await signupButton.waitFor({ state: 'visible', timeout: 30000 });
                await this.sleep(3000); // Small delay before clicking

                // Click the button
                await signupButton.click({ timeout: 10000 });

                await this.sleep(this.randomFloat(1000, 2000));

                try {
                    const emailInputCheck = page.getByRole('textbox', { name: 'Email address' });
                    await emailInputCheck.waitFor({ state: 'visible', timeout: 5000 });
                } catch {
                    this.log("⚠️ Dialog might not have appeared, continuing anyway...", "WARNING");
                }

            } catch (e) {
                this.log(`❌ Error processing signup`);
                return false;
            }

            // Fill email
            try {
                const emailInput = page.getByRole('textbox', { name: 'Email address' });
                await emailInput.waitFor({ state: 'visible', timeout: 15000 });

                await emailInput.fill(email);
                await emailInput.blur();

                await this.sleep(this.randomFloat(2000, 3000));

                const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
                await continueButton.waitFor({ state: 'visible', timeout: 10000 });

                const isEnabled = await continueButton.isEnabled();
                if (!isEnabled) {
                    this.log("⏳ Continue button not enabled yet, waiting for validation...");
                    await this.sleep(2000);
                }

                await this.sleep(this.randomFloat(500, 1000));

            } catch (e) {
                return false;
            }

            // Click Continue
            try {
                const continueButton = page.getByRole('button', { name: 'Continue', exact: true });

                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { }),
                    continueButton.click({ timeout: 10000 })
                ]);

                await this.sleep(1000);

                const currentUrl = page.url();

                if (currentUrl.toLowerCase().includes('password') || currentUrl.toLowerCase().includes('auth.openai.com')) {
                    this.log(`✅ Setting up password`);
                } else if (currentUrl.toLowerCase().includes('error')) {
                    return false;
                }

            } catch (e) {
                const currentUrl = page.url();
                if (currentUrl.toLowerCase().includes('error')) {
                    return false;
                } else {
                    await this.sleep(2000);
                    const newUrl = page.url();
                    if (newUrl.toLowerCase().includes('error')) {
                        return false;
                    } else if (!newUrl.toLowerCase().includes('password')) {
                        return false;
                    }
                }
            }

            // Fill password
            try {
                const passwordInput = page.getByRole('textbox', { name: 'Password' });
                await passwordInput.waitFor({ state: 'visible', timeout: 15000 });

                await passwordInput.fill(password);
                await this.sleep(this.randomFloat(1000, 2000));
            } catch (e) {
                return false;
            }

            // Click Continue after password
            try {
                let continueButton = page.getByRole('button', { name: 'Continue' });
                await continueButton.waitFor({ state: 'visible', timeout: 15000 });

                const isEnabled = await continueButton.isEnabled();
                if (!isEnabled) {
                    this.log("⏳ Button not enabled yet, waiting...");
                    await this.sleep(2000);
                }

                const box = await continueButton.boundingBox();
                if (box) {
                    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                    await this.sleep(this.randomFloat(300, 700));
                }

                try {
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { }),
                        continueButton.click({ timeout: 10000 })
                    ]);
                    await this.sleep(this.randomFloat(2000, 3000));
                } catch {
                    await continueButton.click({ timeout: 10000 });
                    await this.sleep(this.randomFloat(2000, 3000));
                }
            } catch (e) {
                this.log(`❌ Error clicking Continue: ${e.message}`, "ERROR");
                return false;
            }

            // Wait for verification code
            this.log("⏳ Waiting for verification code...");
            await this.sleep(8000);

            const verificationCode = await this.getVerificationCode(email);

            if (!verificationCode) {
                this.log(`❌ Failed to get verification code for ${email}`, "ERROR");
                await context.close();
                return false;
            }

            // Enter verification code
            try {
                const codeInput = page.getByRole('textbox', { name: 'Code' });
                await codeInput.fill(verificationCode);
                await this.sleep(500);
            } catch (e) {
                return false;
            }

            // Click Continue after code
            try {
                const continueButton = page.getByRole('button', { name: 'Continue' });
                await continueButton.click({ timeout: 10000 });
                await this.sleep(3000);
            } catch (e) {
                return false;
            }

            // Fill name
            try {
                const nameInput = page.getByRole('textbox', { name: 'Full name' });
                await nameInput.fill(name);
                await this.sleep(500);
            } catch (e) {
                return false;
            }

            // Handle birthday - simplified approach
            const monthNum = birthday.month;
            const dayNum = birthday.day;
            const yearNum = birthday.year;

            this.log(`🎂 Setting birthday: ${monthNum}/${dayNum}/${yearNum}`);

            try {
                // Wait for birthday fields to be visible
                await this.sleep(1000);

                // Format birthday as MMDDYYYY (with leading zeros)
                const monthStr = String(monthNum).padStart(2, '0');
                const dayStr = String(dayNum).padStart(2, '0');
                const yearStr = String(yearNum);
                const birthdayString = `${monthStr}${dayStr}${yearStr}`;

                // First click on the Birthday label to activate the field
                const birthdayXpath = "/html/body/div[1]/div/fieldset/form/div[1]/div/div[2]/div/div/div/div"
                const birthdayForm = page.locator(`xpath=${birthdayXpath}`);
                // const birthdayLabel = page.getByText('Birthday', { exact: true }).first();
                if (await birthdayForm.isVisible({ timeout: 5000 })) {
                    await birthdayForm.click();
                    await this.sleep(500);
                }

                // Now find and click the month spinbutton
                const monthSpin = page.locator('[role="spinbutton"][aria-label*="month"]').first();

                if (await monthSpin.isVisible({ timeout: 5000 })) {
                    await monthSpin.click();
                    await this.sleep(300);

                    // Type all digits at once - form will auto-distribute
                    await page.keyboard.type(birthdayString, { delay: 100 });

                    await this.sleep(500);
                } else {
                    throw new Error('Birthday field not found');
                }
            } catch (birthdayError) {
                this.log(`❌ Error setting birthday: ${birthdayError.message}`, "ERROR");
                return false;
            }

            // Click Continue to complete signup
            try {
                const continueButton = page.getByRole('button', { name: 'Finish creating account' });
                await continueButton.waitFor({ state: 'visible', timeout: 10000 });

                const isEnabled = await continueButton.isEnabled();
                if (!isEnabled) {
                    await this.sleep(2000);
                }

                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => { }),
                    continueButton.click({ timeout: 10000 })
                ]);

                await this.sleep(2000);
            } catch (e) {
                return false;
            }

            // Verify account creation
            try {
                const currentUrl = page.url();
                if (currentUrl.includes('chatgpt.com')) {
                    this.log(`✅ Account created successfully!`);
                    this.saveAccount(email, password);
                    await context.close();
                    return true;
                } else {
                    this.log(`⚠️ Unexpected Error after signup`, "WARNING");
                    this.saveAccount(email, password);
                    await context.close();
                    return true;
                }
            } catch (e) {
                this.log(`⚠️ Error verifying account creation`, "WARNING");
                this.saveAccount(email, password);
                await context.close();
                return true;
            }

        } catch (e) {
            return false;
        } finally {
            try {
                await this.sleep(1000);
                if (fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                }
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }

    async createAccounts(numAccounts) {
        console.log(`🚀 Starting account creation for ${numAccounts} accounts...`);

        let successful = 0;
        let failed = 0;

        // Sequential processing - one account at a time
        for (let accountNum = 1; accountNum <= numAccounts; accountNum++) {
            // Set progress for logging
            this.currentProgress = `${accountNum}/${numAccounts}`;

            try {
                const success = await this.createAccount(accountNum, numAccounts);

                if (success) {
                    successful++;
                    this.log(`✅ Account completed successfully\n`);
                } else {
                    failed++;
                    this.log(`❌ Account failed\n`);
                }

                // Delay between accounts if not the last one
                if (accountNum < numAccounts) {
                    const delay = this.randomFloat(2000, 4000);
                    // this.log(`⏳ Waiting ${Math.round(delay / 1000)}s before next account...`);
                    await this.sleep(delay);
                }

            } catch (e) {
                this.log(`💥 Error: ${e.message}\n`);
                failed++;
            }
        }

        // Reset progress
        this.currentProgress = null;

        this.printSummary(successful, failed);
    }

    printSummary(successful, failed) {
        console.log("\n" + "=".repeat(60));
        console.log("📊 ACCOUNT CREATION SUMMARY");
        console.log("=".repeat(60));
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📝 Total accounts saved: ${this.createdAccounts.length}`);
        console.log(`💾 Accounts saved to: ${this.accountsFile}`);

        if (this.createdAccounts.length > 0) {
            console.log("\n✅ CREATED ACCOUNTS:");
            this.createdAccounts.forEach((account, i) => {
                console.log(`  ${i + 1}. ${account.email}`);
            });
        }

        console.log("=".repeat(60));
    }
}

async function main() {
    console.log("🤖 ChatGPT Account Creator");
    console.log("=".repeat(60));

    const creator = new ChatGPTAccountCreator();

    console.log(`⚙️ Configuration loaded`);
    // console.log(`   - Headless mode: ${creator.config.headless !== false}`);

    const password = creator.config.password;
    // if (password) {
    //     console.log(`   - Password: ${'*'.repeat(Math.min(password.length, 20))} (from config.json)`);
    // } else {
    //     console.log(`   - Password: ❌ NOT SET (please add 'password' to config.json)`);
    // }
    console.log();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        const answer = await new Promise((resolve) => {
            rl.question("\n📝 How many accounts do you want to create? ", resolve);
        });

        const numAccounts = parseInt(answer, 10);
        if (isNaN(numAccounts) || numAccounts <= 0) {
            console.log("❌ Please enter a positive number!");
            rl.close();
            return;
        }

        console.log(`\n🚀 Starting creation of ${numAccounts} account(s)...`);
        console.log(`   Processing one account at a time (sequential mode)\n`);

        await creator.createAccounts(numAccounts);

    } catch (e) {
        if (e.message === 'readline was closed') {
            console.log("\n\n🛑 Script interrupted by user (Ctrl+C)");
            console.log("✅ Progress saved to accounts.txt");
        } else {
            console.log(`\n❌ Error: ${e.message}`);
        }
    } finally {
        rl.close();
    }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log("\n\n🛑 Script interrupted by user (Ctrl+C)");
    console.log("✅ Progress saved to accounts.txt");
    process.exit(0);
});

main().catch(console.error);
