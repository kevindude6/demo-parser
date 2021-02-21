import { DemoModel } from "./demo-model";
import { DemoParserConfig } from "./demo-parser";

export class ScriptParser {
    protected config: DemoParserConfig;

    constructor(config: DemoParserConfig) {
        this.config = config;
    }

    public parseScript(buffer: Buffer) : Omit<DemoModel.Info.Info, "meta"> {
        const scriptTxt = `{${buffer.toString()}}`;
        const objStr = scriptTxt
            .replace(/([^d=])(\[(.*?)\])/g, "$1\"$3\":")
            .replace(/^(\w*)\=(.*?);/gm, "\"$1\": \"$2\",")
            .replace(/\r|\n/gm, "")
            .replace(/\",}/gm, "\"}")
            .replace(/}"/gm, "},\"");
        const obj = JSON.parse(objStr).game;

        const hostSettings: any = {};
        for (const [key, val] of Object.entries(obj)) {
            if (typeof(val) === "string") {
                hostSettings[key] = val;
            }
        }

        const { allyTeams, players, ais, spectators } = this.parsePlayers(obj);

        return {
            hostSettings: hostSettings,
            gameSettings: obj.modoptions,
            mapSettings: obj.mapoptions,
            restrictions: obj.restrict,
            allyTeams,
            players,
            ais,
            spectators
        };
    }

    protected parseSettings(str: string) : { [key: string]: string } {
        const pairs = str.split(";").filter(Boolean).map(pair => pair.split("="));

        const obj: { [key: string]: string } = {};
        for (const [key, val] of pairs) {
            obj[key] = val;
        }

        return obj;
    }

    protected parsePlayers(scriptObj: any) {
        const allyTeams: DemoModel.Info.AllyTeam[] = [];
        const teams: { [teamId: number]: DemoModel.Info.Team } = {};
        const partialPlayers: Array<Partial<DemoModel.Info.Player>> = [];
        const partialAis: Array<Partial<DemoModel.Info.AI>> = [];
        const spectators: DemoModel.Info.Spectator[] = [];

        for (const key in scriptObj) {
            const obj = scriptObj[key];
            if (key.includes("ally") && typeof obj === "object") {
                const allyTeamId = parseInt(key.split("allyteam")[1]);
                const startBox = obj.startrectbottom ? {
                    bottom: parseFloat(obj.startrectbottom),
                    left: parseFloat(obj.startrectleft),
                    top: parseFloat(obj.startrecttop),
                    right: parseFloat(obj.startrectright),
                } : undefined;
                allyTeams.push({ allyTeamId, startBox});
            } else if (key.includes("team") && typeof obj === "object") {
                const teamId = parseInt(key.split("team")[1]);
                const allyTeamId = parseInt(obj.allyteam);
                const teamLeaderId = parseInt(obj.teamleader);
                const rgbColor = obj.rgbcolor.split(" ").map((str:string) => parseFloat(str));
                const handicap = parseInt(obj.handicap);
                const faction = obj.side;
                teams[teamId] = { teamId, allyTeamId, teamLeaderId, rgbColor, handicap, faction };
            } else if (key.includes("player") && typeof obj === "object") {
                const isSpec = obj.spectator === "1";
                const playerId = parseInt(key.split("player")[1]);
                const rank = parseInt(obj.rank);
                const name = obj.name;
                const isFromDemo = obj.isfromdemo ? obj.isfromdemo === "1" : undefined;
                const userId = parseInt(obj.accountid) || undefined;
                const countryCode = obj.countrycode || undefined;
                const skillclass = parseInt(obj.skillclass) || undefined;
                const skillUncertainty = parseInt(obj.skilluncertainty) || undefined;
                const skill = obj.skill || undefined;
                const playerOrSpec: DemoModel.Info.Player | DemoModel.Info.Spectator = {
                    playerId, userId, name, countryCode, rank, skillclass, skillUncertainty, skill, isFromDemo
                };

                if (!isSpec) {
                    partialPlayers.push({
                        ...playerOrSpec,
                        teamId: parseInt(obj.team)
                    });
                } else {
                    spectators.push(playerOrSpec);
                }
            } else if (key.includes("ai") && typeof obj === "object") {
                const partialAi: Partial<DemoModel.Info.AI> = {
                    aiId: parseInt(key.split("ai")[1]),
                    shortName: obj.shortname,
                    name: obj.name,
                    host: obj.host === "1",
                    teamId: parseInt(obj.team),
                    isFromDemo: obj.isfromdemo ? obj.isfromdemo === "1" : undefined,
                    version: obj.version || undefined,
                    options: obj.options || undefined
                };
                partialAis.push(partialAi);
            }
        }

        for (const player of partialPlayers) {
            const team = teams[player.teamId!];
            player.rgbColor = { r: 255 * team.rgbColor[0], g: 255 * team.rgbColor[1], b: 255 * team.rgbColor[2] };
            player.allyTeamId = team.allyTeamId;
            player.handicap = team.handicap;
            player.faction = team.faction;
        }

        for (const ai of partialAis) {
            const team = teams[ai.teamId!];
            ai.rgbColor = { r: 255 * team.rgbColor[0], g: 255 * team.rgbColor[1], b: 255 * team.rgbColor[2] };
            ai.allyTeamId = team.allyTeamId;
            ai.handicap = team.handicap;
            ai.faction = team.faction;
        }

        const players = partialPlayers as DemoModel.Info.Player[];
        const ais = partialAis as DemoModel.Info.AI[];

        return { allyTeams, players, ais, spectators };
    }
}