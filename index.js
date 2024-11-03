const fs = require("fs");
const axios = require("axios");
const colors = require("colors");
const readline = require("readline");
const { DateTime } = require("luxon");
const { HttpsProxyAgent } = require("https-proxy-agent");
const {
  questions,
  questionTypes,
  ToolName,
  METHOD,
  maxQuackTime,
} = require("./config");

const BaseRoot = require("./ultils");

class Tools extends BaseRoot {
  constructor() {
    super();
    this.toolsName = ToolName || "";
    this.version = "0.1";
    this.waitingTime = 0;
    this.userInfo = null;
    this.taskInfo = null;
    this.taskList = null;
    this.delayTime = {
      playGame: null,
      dailyClaim: null,
    };
    this.questionStatuses = {
      isPlayGame: false,
      isDoTask: false,
      isDailyClaim: false,
    };
  }

  async renderQuestions() {
    for (let i = 0; i < questions.length; i++) {
      const questionAnswer = await this.askQuestion(questions[i].question);
      this.questionStatuses[questions[i].type] =
        questionAnswer.toLowerCase() === "y" ?? true;
    }
  }

  addingWaitingTime = (extraTime) => {
    if (this.waitingTime < extraTime) {
      this.waitingTime = this.waitingTime + (extraTime - this.waitingTime);
    }
  };

  processAccount = async (queryId, dataUser) => {
    this.log(colors.yellow(`====== [Process Account] ======`));
    const token = await this.login(queryId, dataUser);
    if (true) {
      // Logic here
      await this.getTaskInfo();
      await this.getTaskList();
      await this.sleep(1000);
      if (this.questionStatuses.isDailyClaim) {
        await this.dailyCheckInClaim(queryId, dataUser, token);
      }
      if (this.questionStatuses.isDoTask) {
        await this.resolveTask(queryId, dataUser, token);
      }
      if (this.questionStatuses.isPlayGame) {
        await this.playGame(queryId, dataUser, token);
      }
    }
  };

  login = async (queryId, dataUser) => {
    this.log(colors.yellow(`====== [Login] ======`));
    const header = await this.buildHeader({ Authorization: `tma ${queryId}` });
    try {
      const response = await this.callApi(
        METHOD.GET,
        "https://preapi.duckchain.io/user/info",
        null,
        header
      );
      if (response && response.data.code === 200) {
        this.log(colors.green(`\Login ${this.toolsName} successfully!`));
        if (response.data.data) {
          this.userInfo = response.data.data;
          await this.sleep(1000);
        }
      } else {
        this.log(colors.red(`Fail to login ${this.toolsName}!`));
        return;
      }
    } catch (error) {
      this.log(colors.red(`Fail to login ${this.toolsName}!`));
      return;
    }
  };

  dailyCheckInClaim = async (queryId, dataUser, token) => {
    this.log(colors.yellow(`====== [Daily Checkin Claim] ======`));
    if (this.delayTime.dailyClaim && this.delayTime.dailyClaim < new Date()) {
      this.log(colors.red(`It's not time to claim daily yet.`));
      return;
    }
    const header = await this.getHeader();
    const { daily: completedDaily } = this.taskInfo;
    const { daily } = this.taskList;

    const dailyTask = daily.find((i) => i.taskId === 8);
    if (!dailyTask || (dailyTask && completedDaily.includes(8))) {
      this.log(colors.red(`Already claim daily reward today!`));
      return;
    }
    try {
      const response = await this.callApi(
        METHOD.GET,
        "https://preapi.duckchain.io/task/sign_in",
        null,
        header
      );
      if (response && response.data.code === 200) {
        this.log(colors.green(`Claim daily reward successfully!`));
        await this.sleep(1000);
        this.delayTime.dailyClaim = this.addHoursToDatetime(24);
      } else {
        this.log(colors.red(`Fail to claim daily reward!`));
      }
    } catch (error) {
      this.log(colors.red(`Fail to claim daily reward!`));
    }
  };

  watchAds = async (queryId, dataUser, token) => {
    this.log(colors.yellow(`====== [Watch Ads] ======`));
    const header = await this.getHeader();
  };

  farmingClaim = async (queryId, dataUser, token) => {
    this.log(colors.yellow(`====== [Farm Claim] ======`));
    const header = await this.getHeader();
  };

  playGame = async (queryId, dataUser, token) => {
    this.log(colors.yellow(`====== [Play Game] ======`));
    const header = await this.getHeader();
    if (maxQuackTime < 1) {
      this.log(
        colors.red(
          `Quack time is ${maxQuackTime}. Update maxQuackTime in config.js!`
        )
      );
      return;
    }
    let quackCount = 0;
    while (this.userInfo.decibels > 0 && quackCount < maxQuackTime) {
      try {
        const response = await this.callApi(
          METHOD.GET,
          `https://preapi.duckchain.io/quack/execute`,
          null,
          header
        );
        if (response && response.data.code === 200) {
          const { quackRecords, quackTimes, decibel } = response.data.data;
          const totalNegative = quackRecords.reduce((sum, num) => {
            const value = parseInt(num);
            return sum + (value < 0 ? value : 0);
          }, 0);
          const earnPoint = quackRecords[quackRecords.length - 1];
          this.log(
            colors.green(
              `Quack no.${quackTimes} | Earn: ${earnPoint} | Total: ${totalNegative} | Remain: ${decibel}`
            )
          );
          this.userInfo.decibels = response.data.data.decibel;
          await this.sleep(1000);
        } else {
          this.log(colors.red(`Fail to quack ticket!`));
        }
      } catch (error) {
        console.log(error);
        this.log(colors.red(`Fail to quack ticket!`));
      }
      quackCount++;
      await this.sleep(1000);
    }
    this.log(colors.green(`Playing game process done!`));
    this.waitingTime = this.waitingTime + 2 * 60 * 60;
  };

  resolveTask = async (queryId, dataUser, token) => {
    const { oneTime: completedOneTime, partner: completedPartner } =
      this.taskInfo;
    const { oneTime, partner } = this.taskList;
    this.log(colors.yellow(`====== [Resolve Task] ======`));

    await this.sleep(1000);
    this.log(colors.cyan(`> One time tasks`));

    for (let i = 0; i < oneTime.length; i++) {
      const task = oneTime[i];
      if (!completedOneTime.includes(task.taskId)) {
        await this.completeTask(task, false);
      } else {
        this.log(colors.green(`Task ${task.content} already claimed!`));
      }
    }

    await this.sleep(1000);
    this.log(colors.cyan(`> Partner tasks`));

    for (let i = 0; i < partner.length; i++) {
      const task = partner[i];
      if (!completedPartner.includes(task.taskId, true)) {
        await this.completeTask(task, true);
      } else {
        this.log(colors.green(`Task ${task.content} already claimed!`));
      }
    }

    this.log(colors.green(`Resolved all tasks`));
  };

  completeTask = async (task, isPartner) => {
    this.log(
      colors.yellow(`====== [Working with task: ${task.content}] ======`)
    );
    const header = await this.getHeader();
    const wrkType = isPartner ? "partner" : "onetime";
    try {
      const response = await this.callApi(
        METHOD.GET,
        `https://preapi.duckchain.io/task/${wrkType}?taskId=${task.taskId}`,
        null,
        header
      );
      if (response && response.data.code === 200) {
        this.log(colors.green(`Claim task ${task.content} successfully!`));
        await this.sleep(1000);
      } else {
        this.log(colors.red(`Fail to claim task ${task.content} reward!`));
      }
    } catch (error) {
      this.log(colors.red(`Fail to claim task ${task.content} reward!`));
    }
  };

  getTaskInfo = async (queryId, dataUser, token) => {
    this.log(colors.yellow(`====== [Get task information] ======`));
    const header = await this.getHeader();
    try {
      const response = await this.callApi(
        METHOD.GET,
        "https://preapi.duckchain.io/task/task_info",
        null,
        header
      );
      if (response && response.data.code === 200) {
        this.log(colors.green(`Get tasks information successfully!`));
        this.taskInfo = response.data.data;
        await this.sleep(1000);
      } else {
        this.log(colors.red(`Fail to tasks information!`));
        return;
      }
    } catch (error) {
      this.log(colors.red(`Fail to tasks information!`));
      return;
    }
  };

  getTaskList = async (queryId, dataUser, token) => {
    this.log(colors.yellow(`====== [Get task list] ======`));
    const header = await this.getHeader();
    try {
      const response = await this.callApi(
        METHOD.GET,
        "https://preapi.duckchain.io/task/task_list",
        null,
        header
      );
      if (response && response.data.code === 200) {
        this.log(colors.green(`Get tasks list successfully!`));
        this.taskList = response.data.data;
        await this.sleep(1000);
      } else {
        this.log(colors.red(`Fail to tasks list!`));
        return;
      }
    } catch (error) {
      this.log(colors.red(`Fail to tasks list!`));
      return;
    }
  };

  connectWallets = async (queryId, dataUser, token) => {
    this.log(colors.yellow(`====== [Connect Wallets] ======`));
    const wallets = this.getWalletFile();
    if (!wallets.length) return;
    const header = await this.getHeader();
  };

  async main() {
    this.renderFiglet(this.toolsName, this.version);
    await this.sleep(1000);
    if (!fs.existsSync("auto_run.txt")) {
      await this.renderQuestions();
    } else {
      const autoRunStatuses = await this.updateQuestionStatuses(
        this.questionStatuses
      );
      this.questionStatuses = autoRunStatuses;
      await this.sleep(1000);
      try {
        fs.unlinkSync("auto_run.txt");
      } catch (err) {}
    }
    await this.sleep(1000);
    if (
      !this.questionStatuses.isPlayGame &&
      !this.questionStatuses.isDoTask &&
      !this.questionStatuses.isDailyClaim
    ) {
      return;
    }

    while (true) {
      const data = this.getDataFile();
      if (!data || data.length < 1) {
        this.log(
          colors.red(`Don't have any data. Please check file data.txt!`)
        );
        await this.sleep(100000);
      }
      for (let i = 0; i < data.length; i++) {
        const queryId = data[i];
        const dataUser = await this.extractUserData(queryId);
        await this.sleep(1000);
        this.log(
          colors.cyan(
            `----------------------=============----------------------`
          )
        );
        this.log(
          colors.cyan(
            `Working with user #${i + 1} | ${dataUser.user.first_name} ${
              dataUser.user.last_name
            }`
          )
        );
        await this.processAccount(queryId, dataUser);
      }
      const extraMinutes = 1 * 60;
      await this.countdown(this.waitingTime + extraMinutes);
    }
  }
}

const client = new Tools();
client.main().catch((err) => {
  client.log(err.message, "error");
});
