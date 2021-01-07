jest.unmock('@wdio/config')

import path from 'path'
import gotMock from 'got'
// @ts-ignore mock feature
import logger, { logMock } from '@wdio/logger'
import * as wdioUtils from '@wdio/utils'
import { Capabilities } from '@wdio/types'

import WebDriver, { getPrototype, DEFAULTS } from '../src'
import { Client } from '../src/types'

const got = gotMock as unknown as jest.Mock
const sessionEnvironmentDetector = wdioUtils.sessionEnvironmentDetector as jest.Mock

const sessionOptions = {
    protocol: 'http',
    hostname: 'localhost',
    port: 4444,
    path: '/',
    sessionId: 'foobar'
}

const OUTPUT_DIR = path.join('some', 'output', 'dir')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'wdio.log')

const setUpLogCheck = (conditionFunction: () => boolean) => {
    const logCheck = (...args: string[]) => {
        if (!conditionFunction()) {
            throw new Error(
                'Log function was called before setting ' +
                'process.env.WDIO_LOG_PATH.\n' +
                'Passed arguments to log function:\n' +
                args.map((arg, index) => `  [${index}]: ${arg}`).join('\n')
            )
        }
    }

    logMock.error.mockImplementation(logCheck)
    logMock.warn.mockImplementation(logCheck)
    logMock.info.mockImplementation(logCheck)
    logMock.debug.mockImplementation(logCheck)
}

interface TestClient extends Client {
    getUrl (): string
    getApplicationCacheStatus (): void
    takeElementScreenshot (): void
    getDeviceTime (): void
}

describe('WebDriver', () => {
    test('exports getPrototype, DEFAULTS', () => {
        expect(typeof getPrototype).toBe('function')
        expect(typeof DEFAULTS).toBe('object')
    })
    describe('newSession', () => {
        afterEach(() => {
            delete process.env.WDIO_LOG_PATH

            logMock.error.mockRestore()
            logMock.warn.mockRestore()
            logMock.info.mockRestore()
            logMock.debug.mockRestore()
        })

        it('should allow to create a new session using jsonwire caps', async () => {
            const testDirPath = './logs'
            await WebDriver.newSession({
                path: '/',
                outputDir: testDirPath,
                capabilities: { browserName: 'firefox' }
            })

            const url = got.mock.calls[0][0]
            const req = got.mock.calls[0][1]
            expect(url.pathname).toBe('/session')
            expect(req.json).toEqual({
                capabilities: {
                    alwaysMatch: { browserName: 'firefox' },
                    firstMatch: [{}]
                },
                desiredCapabilities: { browserName: 'firefox' }
            })
            expect(process.env.WDIO_LOG_PATH).toEqual(path.join(testDirPath, 'wdio.log'))
        })

        it('should allow to create a new session using w3c compliant caps', async () => {
            await WebDriver.newSession({
                path: '/',
                capabilities: {
                    alwaysMatch: { browserName: 'firefox' },
                    firstMatch: [{}]
                }
            })

            const url = got.mock.calls[0][0]
            const req = got.mock.calls[0][1]
            expect(url.pathname).toBe('/session')
            expect(req.json).toEqual({
                capabilities: {
                    alwaysMatch: { browserName: 'firefox' },
                    firstMatch: [{}]
                },
                desiredCapabilities: { browserName: 'firefox' }
            })

            expect(sessionEnvironmentDetector.mock.calls)
                .toMatchSnapshot()
        })

        it('should allow to use Appium direct connect functionality', async () => {
            setUpLogCheck(() => process.env.WDIO_LOG_PATH === OUTPUT_FILE)

            await WebDriver.newSession({
                directConnectProtocol: 'https',
                directConnectHost: 'foobar',
                directConnectPort: 1234,
                directConnectPath: '/foo/bar',
                path: '/',
                capabilities: {
                    alwaysMatch: { browserName: 'firefox' },
                    firstMatch: [{}]
                },
                outputDir: OUTPUT_DIR,
            })

            const url = got.mock.calls[0][0]
            expect(url.href).toEqual('https://foobar:1234/foo/bar/session')
        })

        it('should be possible to skip setting logLevel', async () => {
            await WebDriver.newSession({
                capabilities: { browserName: 'chrome' },
                logLevel: 'info',
                logLevels: { webdriver: 'silent' }
            })

            expect(logger.setLevel).not.toBeCalled()
        })

        it('should be possible to set logLevel', async () => {
            await WebDriver.newSession({
                capabilities: { browserName: 'chrome' },
                logLevel: 'info'
            })

            expect(logger.setLevel).toBeCalled()
        })

        it('should be possible to skip setting outputDir', async () => {
            setUpLogCheck(() => !('WDIO_LOG_PATH' in process.env))

            await WebDriver.newSession({
                capabilities: { browserName: 'chrome' },
            })

            expect('WDIO_LOG_PATH' in process.env).toBe(false)
        })

        it('should be possible to set outputDir', async () => {
            setUpLogCheck(() => process.env.WDIO_LOG_PATH === OUTPUT_FILE)

            await WebDriver.newSession({
                capabilities: { browserName: 'chrome' },
                outputDir: OUTPUT_DIR,
            })

            expect(process.env.WDIO_LOG_PATH).toBe(OUTPUT_FILE)
        })

        it('should be possible to override outputDir with env var', async () => {
            const customPath = '/some/custom/path'

            setUpLogCheck(() => process.env.WDIO_LOG_PATH === customPath)

            process.env.WDIO_LOG_PATH = customPath

            await WebDriver.newSession({
                capabilities: { browserName: 'chrome' },
                outputDir: OUTPUT_DIR,
            })

            expect(process.env.WDIO_LOG_PATH).not.toBe(OUTPUT_DIR)
            expect(process.env.WDIO_LOG_PATH).toBe(customPath)
        })

        it('propagates capabilities and requestedCapabilities', async () => {
            const browser = await WebDriver.newSession({
                path: '/',
                capabilities: { browserName: 'firefox' }
            })
            expect((browser.capabilities as Capabilities.DesiredCapabilities).browserName).toBe('mockBrowser')
            expect((browser.requestedCapabilities as Capabilities.DesiredCapabilities).browserName).toBe('firefox')
        })
    })

    describe('attachToSession', () => {
        it('should allow to attach to existing session', async () => {
            const client = WebDriver.attachToSession({ ...sessionOptions }) as TestClient
            await client.getUrl()
            const url = got.mock.calls[0][0]
            expect(url.href).toBe('http://localhost:4444/session/foobar/url')
            expect(logger.setLevel).toBeCalled()
        })

        it('should allow to attach to existing session2', async () => {
            const client = WebDriver.attachToSession({ ...sessionOptions }) as TestClient
            await client.getUrl()
            const url = got.mock.calls[0][0]
            expect(url.href).toBe('http://localhost:4444/session/foobar/url')
            expect(logger.setLevel).not.toBeCalled()
        })

        it('should allow to attach to existing session - W3C', async () => {
            const client = WebDriver.attachToSession({ ...sessionOptions }) as TestClient
            await client.getUrl()

            expect(client.isChrome).toBeFalsy()
            expect(client.isMobile).toBeFalsy()
            expect(client.isSauce).toBeFalsy()
            expect(client.getApplicationCacheStatus).toBeFalsy()
            expect(client.takeElementScreenshot).toBeTruthy()
            expect(client.getDeviceTime).toBeFalsy()
        })

        it('should allow to attach to existing session - non W3C', async () => {
            const client = WebDriver.attachToSession({ ...sessionOptions,
                isW3C: false,
                isSauce: true,
            }) as TestClient

            await client.getUrl()

            expect(client.isSauce).toBe(true)
            expect(client.getApplicationCacheStatus).toBeTruthy()
            expect(client.takeElementScreenshot).toBeFalsy()
            expect(client.getDeviceTime).toBeFalsy()
        })

        it('should allow to attach to existing session - mobile', async () => {
            const client = WebDriver.attachToSession({ ...sessionOptions,
                isChrome: true,
                isMobile: true
            }) as TestClient

            await client.getUrl()

            expect(client.isChrome).toBe(true)
            expect(client.isMobile).toBe(true)
            expect(client.getApplicationCacheStatus).toBeTruthy()
            expect(client.takeElementScreenshot).toBeTruthy()
            expect(client.getDeviceTime).toBeTruthy()
        })

        it('it should propagate all environment flags', () => {
            const client = WebDriver.attachToSession({ ...sessionOptions,
                isW3C: false,
                isMobile: false,
                isIOS: false,
                isAndroid: false,
                isChrome: false,
                isSauce: false
            })
            expect(client.isW3C).toBe(false)
            expect(client.isMobile).toBe(false)
            expect(client.isIOS).toBe(false)
            expect(client.isAndroid).toBe(false)
            expect(client.isChrome).toBe(false)
            expect(client.isSauce).toBe(false)

            const anotherClient = WebDriver.attachToSession({ ...sessionOptions,
                isW3C: true,
                isMobile: true,
                isIOS: true,
                isAndroid: true,
                isChrome: true,
                isSauce: true
            })
            expect(anotherClient.isW3C).toBe(true)
            expect(anotherClient.isMobile).toBe(true)
            expect(anotherClient.isIOS).toBe(true)
            expect(anotherClient.isAndroid).toBe(true)
            expect(anotherClient.isChrome).toBe(true)
            expect(anotherClient.isSauce).toBe(true)
        })

        it('should fail attaching to session if sessionId is not given', () => {
            // @ts-ignore
            expect(() => WebDriver.attachToSession({}))
                .toThrow(/sessionId is required/)
        })
    })

    describe('reloadSession', () => {
        it('should reload session', async () => {
            const session = await WebDriver.newSession({
                path: '/',
                capabilities: { browserName: 'firefox' }
            })
            await WebDriver.reloadSession(session)
            expect(got.mock.calls).toHaveLength(2)
        })
    })

    it('ensure that WebDriver interface exports protocols and other objects', () => {
        expect(WebDriver.WebDriver).not.toBe(undefined)
    })

    afterEach(() => {
        (logger.setLevel as jest.Mock).mockClear()
        got.mockClear()
        sessionEnvironmentDetector.mockClear()
    })
})
