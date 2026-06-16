import { describe, expect, it, vi } from 'vitest'
import { loadConfig } from './env.js'

describe('config validation (issue #12)', () => {
  it('applies defaults when env is empty', () => {
    const cfg = loadConfig({})
    expect(cfg.PORT).toBe(3001)
    expect(cfg.HOST).toBe('0.0.0.0')
    expect(cfg.CORS_ORIGIN).toBe('http://localhost:5173')
    expect(cfg.IPTV_API_BASE_URL).toBe('https://iptv-org.github.io/api')
  })

  it('parses a valid PORT into a number', () => {
    const cfg = loadConfig({ PORT: '8080' })
    expect(cfg.PORT).toBe(8080)
  })

  it('accepts DB_PATH as an alias for DATABASE_PATH', () => {
    const cfg = loadConfig({ DB_PATH: '/tmp/custom.db' })
    expect(cfg.DATABASE_PATH).toBe('/tmp/custom.db')
  })

  it('exposes derived environment flags', () => {
    const cfg = loadConfig({ NODE_ENV: 'production' })
    expect(cfg.isProd).toBe(true)
    expect(cfg.isDev).toBe(false)
    expect(cfg.isTest).toBe(false)
  })

  it('rejects a non-numeric PORT (aborts with a readable error)', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('process.exit called')
    }) as never)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => loadConfig({ PORT: 'not-a-number' })).toThrow('process.exit called')
    expect(errSpy).toHaveBeenCalled()
    const message = errSpy.mock.calls.flat().join(' ')
    expect(message).toContain('PORT')

    exitSpy.mockRestore()
    errSpy.mockRestore()
  })
})
