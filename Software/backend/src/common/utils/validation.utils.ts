export function ValidateCedulaEcuatoriana(cedula: string): boolean {
    if (!cedula || cedula.length !== 10) return false;

    const codigoProvincia = parseInt(cedula.substring(0, 2));
    if (codigoProvincia < 1 || codigoProvincia > 24) return false;

    const digitoVerificador = parseInt(cedula.charAt(9));
    const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];

    let suma = 0;
    for (let i = 0; i < 9; i++) {
        let valor = parseInt(cedula.charAt(i)) * coeficientes[i];
        if (valor > 9) valor -= 9;
        suma += valor;
    }

    const resultado = suma % 10 === 0 ? 0 : 10 - (suma % 10);
    return resultado === digitoVerificador;
}
