/*
 * This file is released under the MIT license.
 * Copyright (c) 2017, 2020, Mike Lischke
 *
 * See LICENSE file for more info.
 */

import { StatusBarAlignment, StatusBarItem, window } from "vscode";

export class ProgressIndicator {
    private static progressChars = "⠁⠃⠅⡁⢁⠡⠑⠉⠁⠃⠇⡃⢃⠣⠓⠋⠃⠃⠇⡇⢇⠧⠗⠏⠇⠇⠇⡇⣇⡧⡗⡏⡇⡇⡇⡇⣇⣧⣗⣏⣇⣇⣇⣇⣇⣧⣷⣯⣧⣧⣧⣧⣧⣧⣷⣿⣿⣿⣿⣿⣿⣿⣿";

    private statusBarItem: StatusBarItem;
    private timer: any;
    private progress = 0;

    public constructor() {
        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 0);
        this.statusBarItem.hide();
        this.statusBarItem.tooltip = "LPG generating interpreter data";
    }

    public startAnimation(): void {
        this.statusBarItem.show();
        this.timer = setInterval(() => {
            const index = this.progress % ProgressIndicator.progressChars.length;
            this.statusBarItem.text = "LPG " + ProgressIndicator.progressChars.charAt(index);
            this.progress++;
        }, 50);
    }

    public stopAnimation(): void {
        clearInterval(this.timer);
        this.timer = null;
        this.statusBarItem.hide();
    }
}
