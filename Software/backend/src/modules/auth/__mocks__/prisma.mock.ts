/**
 * Mock de PrismaService para usar en las pruebas
 * Este mock simula las operaciones de base de datos sin conectarse realmente
 */
export const mockPrismaService = {
  usuario: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  rol: {
    findFirst: jest.fn(),
  },
  perfilMedico: {
    create: jest.fn(),
  },
  consentimiento: {
    createMany: jest.fn(),
  },
  sesion: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  logActividad: {
    create: jest.fn(),
  },
};

export const resetMocks = () => {
  Object.values(mockPrismaService).forEach((model) => {
    if (typeof model === 'object') {
      Object.values(model).forEach((method) => {
        if (jest.isMockFunction(method)) {
          method.mockReset();
        }
      });
    }
  });
};
