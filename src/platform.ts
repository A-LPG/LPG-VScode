/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All Rights Reserved.
 * See 'LICENSE' in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as os from 'os';
import { LinuxDistribution } from './linuxDistribution';
import * as plist from 'plist';
import * as fs from 'fs';
import { window } from 'vscode';


export function GetOSName(processPlatform: string | undefined): string | undefined {
    switch (processPlatform) {
        case "win32": return "Windows";
        case "darwin": return "macOS";
        case "linux": return "Linux";
        default: return undefined;
    }
}

export class PlatformInformation {
    constructor(public platform: string, public architecture: string, public distribution?: LinuxDistribution, public version?: string) { }

    public static async GetPlatformInformation(): Promise<PlatformInformation> {
        const platform: string = os.platform();
        const architecture: string = PlatformInformation.GetArchitecture();
        let distribution: LinuxDistribution | undefined;
        let version: string | undefined;
        switch (platform) {
            case "win32":
                break;
            case "linux":
                distribution = await LinuxDistribution.GetDistroInformation();
                break;
            case "darwin":
                version = await PlatformInformation.GetDarwinVersion();
                break;
            default:
                throw new Error("Unknown OS platform");
        }

        return new PlatformInformation(platform, architecture, distribution, version);
    }

    public static GetArchitecture(): string {
        const arch: string = os.arch();
        switch (arch) {
            case "x64":
            case "arm64":
            case "arm":
                return arch;
            case "x32":
            case "ia32":
                return "x86";
            default:
                if (os.platform() === "win32") {
                    return "x86";
                } else {
                    return "x64";
                }
        }
    }

    private static GetDarwinVersion(): Promise<string> {
        const DARWIN_SYSTEM_VERSION_PLIST: string = "/System/Library/CoreServices/SystemVersion.plist";
        let productDarwinVersion: string = "";
        let errorMessage: string = "";

        if (fs.existsSync(DARWIN_SYSTEM_VERSION_PLIST)) {
            const systemVersionPListBuffer: Buffer = fs.readFileSync(DARWIN_SYSTEM_VERSION_PLIST);
            const systemVersionData: any = plist.parse(systemVersionPListBuffer.toString());
            if (systemVersionData) {
                productDarwinVersion = systemVersionData.ProductVersion;
            } else {
                errorMessage = "Could not get ProduceVersion from SystemVersion.plist";
            }
        } else {
            errorMessage =  "Failed to find SystemVersion.plist in "+  DARWIN_SYSTEM_VERSION_PLIST ;
        }

        if (errorMessage) {
            window.showErrorMessage(errorMessage);
        }

        return Promise.resolve(productDarwinVersion);
    }
}
