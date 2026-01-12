import { test, expect } from '@playwright/test';

/**
 * Patient Journey E2E Test - Frontend UI  
 * With better error handling and debugging
 */

test.describe('Patient Login Flow', () => {
    test('should successfully login with valid credentials', async ({ page }) => {
        await page.goto('/auth/login');

        // Verify login page loaded
        await expect(page.locator('h1')).toContainText('Laboratorio Franz');

        // Fill login form
        await page.locator('#identifier').fill('maria.gonzalez@example.com');
        await page.locator('#password').fill('Paciente123!');

        // Submit
        await page.getByRole('button', { name: /Iniciar Sesión/i }).click();

        // Wait for ANY navigation away from login
        await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 10000 });

        // Verify we ended up at portal
        await expect(page).toHaveURL(/\/portal/);

        // Verify portal loaded
        await expect(page.locator('h1')).toContainText(/María|Bienvenid|Buenos|Buenas/i, { timeout: 10000 });
    });

    test('should show error with invalid credentials', async ({ page }) => {
        await page.goto('/auth/login');

        await expect(page.locator('h1')).toContainText('Laboratorio Franz');

        await page.locator('#identifier').fill('invalid@example.com');
        await page.locator('#password').fill('WrongPassword123');

        await page.getByRole('button', { name: /Iniciar Sesión/i }).click();

        // Verify error message
        await expect(page.locator('.bg-lab-danger-50')).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Patient Portal - Authenticated', () => {
    // Login before each test
    test.beforeEach(async ({ page }) => {
        // Navigate to login
        await page.goto('/auth/login');

        // Wait for page to be fully loaded
        await page.waitForLoadState('networkidle');

        // Fill and submit
        await page.locator('#identifier').fill('maria.gonzalez@example.com');
        await page.locator('#password').fill('Paciente123!');

        // Click login button
        await page.getByRole('button', { name: /Iniciar Sesión/i }).click();

        // Wait for navigation - be flexible about the exact URL
        await page.waitForFunction(() => {
            return window.location.pathname.includes('/portal');
        }, { timeout: 15000 });

        // Additional wait for portal to load
        await page.waitForTimeout(1000);

        // Verify we're actually logged in by checking for sidebar
        await expect(page.getByText('Portal Paciente')).toBeVisible({ timeout: 10000 });
    });

    test('should display dashboard correctly', async ({ page }) => {
        // Should be at portal
        await expect(page).toHaveURL(/\/portal/);

        // Verify welcome message
        await expect(page.locator('h1').first()).toBeVisible({ timeout: 5000 });

        // Verify stats cards
        await expect(page.getByText('Citas Próximas')).toBeVisible();
    });

    test('should show quick actions', async ({ page }) => {
        await expect(page.getByText('Acciones Rápidas')).toBeVisible();
        await expect(page.getByText('Agendar Cita')).toBeVisible();
    });

    test('should navigate to appointments page', async ({ page }) => {
        // Click sidebar link
        await page.getByRole('link', { name: /Mis Citas/i }).first().click();

        // Wait for navigation
        await page.waitForFunction(() => window.location.pathname === '/portal/citas', { timeout: 5000 });
        await expect(page).toHaveURL('/portal/citas');
    });

    test('should navigate to quotations page', async ({ page }) => {
        await page.getByRole('link', { name: /Cotizaciones/i }).first().click();
        await page.waitForFunction(() => window.location.pathname === '/portal/cotizaciones', { timeout: 5000 });
        await expect(page).toHaveURL('/portal/cotizaciones');
    });

    test('should navigate to profile page', async ({ page }) => {
        await page.getByRole('link', { name: /Mi Perfil/i }).first().click();
        await page.waitForFunction(() => window.location.pathname === '/portal/perfil', { timeout: 5000 });
        await expect(page).toHaveURL('/portal/perfil');
    });

    test('should navigate to results page', async ({ page }) => {
        await page.getByRole('link', { name: /^Resultados$/i }).first().click();
        await page.waitForFunction(() => window.location.pathname === '/portal/resultados', { timeout: 5000 });
        await expect(page).toHaveURL('/portal/resultados');
    });

    test('should navigate between pages using sidebar', async ({ page }) => {
        // Navigate to citas
        await page.getByRole('link', { name: /Mis Citas/i }).first().click();
        await page.waitForFunction(() => window.location.pathname === '/portal/citas', { timeout: 5000 });

        // Navigate to resultados
        await page.getByRole('link', { name: /^Resultados$/i }).first().click();
        await page.waitForFunction(() => window.location.pathname === '/portal/resultados', { timeout: 5000 });

        // Back to dashboard
        await page.getByRole('link', { name: /Dashboard/i }).first().click();
        await page.waitForFunction(() => window.location.pathname === '/portal', { timeout: 5000 });
    });

    test('should logout successfully', async ({ page }) => {
        // Click logout
        await page.getByRole('button', { name: /Cerrar Sesión/i }).click();

        // Verify redirect
        await page.waitForFunction(() => window.location.pathname.includes('/auth/login'), { timeout: 5000 });
        await expect(page).toHaveURL(/\/auth\/login/);
    });
});
